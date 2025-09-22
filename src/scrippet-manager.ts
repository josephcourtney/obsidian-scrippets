import {
  App,
  DataAdapter,
  Notice,
  Plugin,
  TAbstractFile,
  TFile,
  normalizePath,
} from "obsidian";
import { parseScrippetMetadata, toDisplayName, toIdentifier } from "./metadata";
import { loadScrippet } from "./scrippet-loader";
import { confirmFirstRun } from "./ui/confirm-run-modal";
import type {
  LoadedScrippet,
  ScrippetDescriptor,
  ScrippetLoadError,
  ScrippetPluginSettings,
  ScrippetScanResult,
  ScrippetKind,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";

const STARTUP_FOLDER = "startup";
const COMMAND_PREFIX = "scrippet";

export interface ScrippetHost extends Plugin {
  app: App;
  settings: ScrippetPluginSettings;
  saveSettings: () => Promise<void>;
}

export class ScrippetManager {
  private readonly plugin: ScrippetHost;
  private commands = new Map<string, string>();
  private loaded = new Map<string, LoadedScrippet>();
  private listeners = new Set<() => void>();
  private reloadTimer: number | null = null;
  private lastScan: ScrippetScanResult = {
    commands: [],
    startup: [],
    errors: [],
    skipped: [],
  };

  constructor(plugin: ScrippetHost) {
    this.plugin = plugin;
  }

  get scan(): ScrippetScanResult {
    return this.lastScan;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  async initialize(): Promise<void> {
    await this.ensureFolders();
    await this.reload({ runStartup: this.plugin.settings.runStartupOnLoad });
    this.registerWatchers();
  }

  async setFolder(newFolder: string): Promise<void> {
    const normalized = normalizePath(newFolder.trim() || DEFAULT_SETTINGS.folder);
    if (normalized === this.plugin.settings.folder) return;
    this.plugin.settings.folder = normalized;
    await this.plugin.saveSettings();
    await this.ensureFolders();
    await this.reload({ runStartup: this.plugin.settings.runStartupOnLoad });
  }

  async reload(options: { runStartup?: boolean } = {}): Promise<void> {
    const { runStartup = false } = options;
    const result = await this.scanScrippets();
    this.unregisterCommands();
    this.loaded.clear();

    this.lastScan = result;

    for (const descriptor of result.commands) {
      if (!descriptor.enabled) continue;
      this.registerCommand(descriptor);
    }

    if (runStartup) {
      await this.executeStartup(result.startup);
    }

    this.notify();
  }

  async runStartupScripts(): Promise<void> {
    await this.executeStartup(this.lastScan.startup);
  }

  async executeFromPath(path: string): Promise<void> {
    const descriptor = this.loaded.get(path);
    if (!descriptor) return;
    await this.executeDescriptor(descriptor);
  }

  private async executeDescriptor(descriptor: LoadedScrippet): Promise<void> {
    const key = this.preferenceKey(descriptor.path);
    const prefs = (this.plugin.settings.scriptStates[key] ||= {
      enabled: descriptor.enabled,
      hasRun: false,
    });

    if (!prefs.enabled) {
      new Notice(`Scrippet "${descriptor.name}" is disabled.`);
      return;
    }

    if (this.plugin.settings.confirmBeforeFirstRun && !prefs.hasRun) {
      const confirmed = await confirmFirstRun(this.plugin.app, descriptor.name);
      if (!confirmed) return;
    }

    try {
      await descriptor.instance.invoke(this.plugin);
      if (!prefs.hasRun) {
        prefs.hasRun = true;
        await this.plugin.saveSettings();
      }
    } catch (error) {
      console.error(`Scrippets: error invoking "${descriptor.name}"`, error);
      new Notice(`Scrippet "${descriptor.name}" failed: ${(error as Error).message ?? error}`);
    }
  }

  toggleDescriptor(descriptor: ScrippetDescriptor, enabled: boolean): void {
    const key = this.preferenceKey(descriptor.path);
    this.plugin.settings.scriptStates[key] = {
      enabled,
      hasRun: this.plugin.settings.scriptStates[key]?.hasRun ?? false,
    };
    descriptor.enabled = enabled;
  }

  private preferenceKey(path: string): string {
    return normalizePath(path);
  }

  private async ensureFolders(): Promise<void> {
    const adapter = this.plugin.app.vault.adapter;
    const base = normalizePath(this.plugin.settings.folder || DEFAULT_SETTINGS.folder);
    await ensureFolder(adapter, base);
    await ensureFolder(adapter, `${base}/${STARTUP_FOLDER}`);
  }

  private registerCommand(descriptor: LoadedScrippet): void {
    const commandId = `${COMMAND_PREFIX}:${descriptor.id}`;
    this.commands.set(descriptor.path, commandId);
    this.loaded.set(descriptor.path, descriptor);
    this.plugin.addCommand({
      id: commandId,
      name: descriptor.name,
      callback: () => this.executeFromPath(descriptor.path),
    });
  }

  private unregisterCommands(): void {
    this.commands.forEach((commandId) => {
      this.plugin.removeCommand(commandId);
    });
    this.commands.clear();
  }

  private async executeStartup(startup: LoadedScrippet[]): Promise<void> {
    let updated = false;
    for (const descriptor of startup) {
      const key = this.preferenceKey(descriptor.path);
      const prefs = this.plugin.settings.scriptStates[key];
      if (prefs && !prefs.enabled) continue;
      try {
        await descriptor.instance.invoke(this.plugin);
        if (!prefs) {
          this.plugin.settings.scriptStates[key] = {
            enabled: true,
            hasRun: true,
          };
          updated = true;
        } else if (!prefs.hasRun) {
          prefs.hasRun = true;
          updated = true;
        }
      } catch (error) {
        console.error(`Scrippets: startup scrippet failed for ${descriptor.name}`, error);
        new Notice(
          `Startup scrippet "${descriptor.name}" failed: ${(error as Error).message ?? error}`,
        );
      }
    }
    if (updated) {
      await this.plugin.saveSettings();
    }
  }

  private async scanScrippets(): Promise<ScrippetScanResult> {
    const baseFolder = normalizePath(this.plugin.settings.folder || DEFAULT_SETTINGS.folder);
    const startupFolder = normalizePath(`${baseFolder}/${STARTUP_FOLDER}`);

    const commandFiles = await this.listJsFiles(baseFolder, (path) => !isWithin(path, startupFolder));
    const startupFiles = await this.listJsFiles(startupFolder);

    const errors: ScrippetLoadError[] = [];
    const skipped: string[] = [];
    const commandDescriptors: LoadedScrippet[] = [];
    const startupDescriptors: LoadedScrippet[] = [];
    const processedIds = new Set<string>();

    await Promise.all(
      commandFiles.map(async (path) => {
        const descriptor = await this.buildDescriptor(path, "command", processedIds, errors, skipped);
        if (descriptor) commandDescriptors.push(descriptor);
      }),
    );

    await Promise.all(
      startupFiles.map(async (path) => {
        const descriptor = await this.buildDescriptor(path, "startup", processedIds, errors, skipped);
        if (descriptor) startupDescriptors.push(descriptor);
      }),
    );

    return {
      commands: commandDescriptors.sort(sortByName),
      startup: startupDescriptors.sort(sortByName),
      errors,
      skipped,
    };
  }

  private async buildDescriptor(
    path: string,
    kind: ScrippetKind,
    processedIds: Set<string>,
    errors: ScrippetLoadError[],
    skipped: string[],
  ): Promise<LoadedScrippet | null> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      const src = await adapter.read(path);
      const { metadata } = parseScrippetMetadata(src);
      const id = toIdentifier(path, metadata);
      if (!id) {
        errors.push({ path, message: "Unable to derive scrippet id" });
        return null;
      }
      if (processedIds.has(id)) {
        errors.push({ path, message: `Duplicate scrippet id "${id}"` });
        skipped.push(path);
        return null;
      }
      processedIds.add(id);

      const name = toDisplayName(path, metadata);
      const description = metadata.description ?? metadata.desc;
      const key = this.preferenceKey(path);
      const preference = (this.plugin.settings.scriptStates[key] ||= {
        enabled: true,
        hasRun: false,
      });
      const instance = loadScrippet(this.plugin, src);
      const descriptor: LoadedScrippet = {
        id,
        name,
        description,
        path,
        kind,
        source: src,
        metadata,
        enabled: preference.enabled,
        instance,
      };
      return descriptor;
    } catch (error) {
      errors.push({ path, message: (error as Error).message ?? String(error) });
      return null;
    }
  }

  private async listJsFiles(folder: string, filter?: (path: string) => boolean): Promise<string[]> {
    const adapter = this.plugin.app.vault.adapter;
    try {
      const listing = await adapter.list(folder);
      const files = listing.files
        .filter((file) => file.toLowerCase().endsWith(".js"))
        .map((file) => normalizePath(file))
        .filter((file) => (filter ? filter(file) : true));
      return files;
    } catch (error) {
      console.debug(`Scrippets: unable to list ${folder}`, error);
      return [];
    }
  }

  private registerWatchers(): void {
    const vault = this.plugin.app.vault;
    const onChange = () => this.scheduleReload();
    this.plugin.registerEvent(vault.on("create", (file) => this.handleFileEvent(file, onChange)));
    this.plugin.registerEvent(vault.on("modify", (file) => this.handleFileEvent(file, onChange)));
    this.plugin.registerEvent(vault.on("delete", (file) => this.handleFileEvent(file, onChange)));
    this.plugin.registerEvent(
      vault.on("rename", (file, oldPath) => {
        if (this.isManagedPath(oldPath) || this.isManagedPath(file.path)) onChange();
      }),
    );
  }

  private handleFileEvent(file: TAbstractFile, onChange: () => void): void {
    if (!(file instanceof TFile)) return;
    if (!this.isManagedPath(file.path)) return;
    onChange();
  }

  private isManagedPath(path: string): boolean {
    const base = normalizePath(this.plugin.settings.folder || DEFAULT_SETTINGS.folder);
    const startup = normalizePath(`${base}/${STARTUP_FOLDER}`);
    const normalized = normalizePath(path);
    return isWithin(normalized, base) || isWithin(normalized, startup);
  }

  private scheduleReload(): void {
    if (this.reloadTimer != null) {
      window.clearTimeout(this.reloadTimer);
    }
    this.reloadTimer = window.setTimeout(() => {
      this.reloadTimer = null;
      void this.reload();
    }, 200);
  }
}

async function ensureFolder(adapter: DataAdapter, folder: string): Promise<void> {
  const target = normalizePath(folder);
  if (await adapter.exists(target)) return;
  try {
    await adapter.mkdir(target);
  } catch (error) {
    console.debug(`Scrippets: unable to create folder ${target}`, error);
  }
}

function isWithin(path: string, folder: string): boolean {
  const normalizedFolder = normalizePath(folder);
  const prefix = `${normalizedFolder}/`;
  return path === normalizedFolder || path.startsWith(prefix);
}

function sortByName(a: ScrippetDescriptor, b: ScrippetDescriptor): number {
  return a.name.localeCompare(b.name);
}
