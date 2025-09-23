import {
  App,
  DataAdapter,
  Notice,
  Plugin,
  TAbstractFile,
  TFile,
  normalizePath,
} from "obsidian";
import {
  buildHeaderSnippet,
  parseScrippetMetadata,
  toDisplayName,
  toIdentifier,
} from "./metadata";
import { loadScrippet } from "./scrippet-loader";
import { confirmFirstRun } from "./ui/confirm-run-modal";
import type {
  LoadedScrippet,
  ScrippetDescriptor,
  ScrippetLoadError,
  ScrippetPluginSettings,
  ScrippetScanResult,
  ScrippetKind,
  ScriptPreference,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";

const STARTUP_FOLDER = "startup";
const COMMAND_PREFIX = "scrippet";

interface PendingChanges {
  changed: Set<string>;
  deleted: Set<string>;
  full: boolean;
}

function createPendingChanges(): PendingChanges {
  return { changed: new Set(), deleted: new Set(), full: false };
}

interface QueuedChange {
  type: "changed" | "deleted" | "full";
  path?: string;
}

export interface ScrippetHost extends Plugin {
  app: App;
  settings: ScrippetPluginSettings;
  saveSettings: () => Promise<void>;
}

export class ScrippetManager {
  private readonly plugin: ScrippetHost;
  private commands = new Map<string, string>();
  private instanceCache = new Map<string, LoadedScrippet>();
  private descriptorsByPath = new Map<string, ScrippetDescriptor>();
  private descriptorsById = new Map<string, ScrippetDescriptor>();
  private listeners = new Set<() => void>();
  private reloadTimer: number | null = null;
  private pendingChanges: PendingChanges = createPendingChanges();
  private settingsDirty = false;
  private errorMap = new Map<string, string>();
  private skipped = new Set<string>();
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
    await this.performFullReload({ runStartup: this.plugin.settings.runStartupOnLoad });
    this.registerWatchers();
  }

  async setFolder(newFolder: string): Promise<void> {
    const normalized = normalizePath(newFolder.trim() || DEFAULT_SETTINGS.folder);
    if (normalized === this.plugin.settings.folder) return;
    this.plugin.settings.folder = normalized;
    await this.plugin.saveSettings();
    await this.ensureFolders();
    await this.performFullReload({ runStartup: this.plugin.settings.runStartupOnLoad });
  }

  async reload(options: { runStartup?: boolean } = {}): Promise<void> {
    await this.performFullReload({ runStartup: options.runStartup ?? false });
  }

  async runStartupScripts(): Promise<void> {
    await this.executeStartup(this.lastScan.startup);
  }

  async executeById(id: string): Promise<void> {
    const descriptor = this.descriptorsById.get(id);
    if (!descriptor) return;
    await this.executeDescriptor(descriptor);
  }

  async toggleDescriptor(descriptor: ScrippetDescriptor, enabled: boolean): Promise<void> {
    const prefs = this.ensurePreference(descriptor.id, descriptor.path);
    prefs.enabled = enabled;
    this.settingsDirty = true;
    const record = this.descriptorsById.get(descriptor.id);
    if (record) record.enabled = enabled;

    if (descriptor.kind === "command") {
      if (enabled) this.registerCommand(record ?? descriptor);
      else this.unregisterCommand(descriptor.id);
    }

    this.updateLastScan();
    this.notify();
    await this.flushSettings();
  }

  private get baseFolder(): string {
    return normalizePath(this.plugin.settings.folder || DEFAULT_SETTINGS.folder);
  }

  private get startupFolder(): string {
    return normalizePath(`${this.baseFolder}/${STARTUP_FOLDER}`);
  }

  private async performFullReload(options: { runStartup: boolean }): Promise<void> {
    this.unregisterCommands();
    this.instanceCache.clear();
    this.descriptorsByPath.clear();
    this.descriptorsById.clear();
    this.errorMap.clear();
    this.skipped.clear();

    const result = await this.scanScrippets();

    for (const descriptor of result.commands) {
      this.storeDescriptor(descriptor);
    }
    for (const descriptor of result.startup) {
      this.storeDescriptor(descriptor);
    }

    this.errorMap.clear();
    for (const error of result.errors) {
      this.errorMap.set(error.path, error.message);
    }
    this.skipped = new Set(result.skipped);

    this.updateLastScan();

    for (const descriptor of this.lastScan.commands) {
      if (descriptor.enabled) this.registerCommand(descriptor);
    }

    await this.flushSettings();
    this.pendingChanges = createPendingChanges();
    this.notify();

    if (options.runStartup) {
      await this.executeStartup(this.lastScan.startup);
    }
  }

  private storeDescriptor(descriptor: ScrippetDescriptor): void {
    this.descriptorsByPath.set(descriptor.path, descriptor);
    this.descriptorsById.set(descriptor.id, descriptor);
  }

  private async executeDescriptor(descriptor: ScrippetDescriptor): Promise<void> {
    const prefs = this.ensurePreference(descriptor.id, descriptor.path);

    if (!prefs.enabled) {
      new Notice(`Scrippet "${descriptor.name}" is disabled.`);
      return;
    }

    if (this.plugin.settings.confirmBeforeFirstRun && !prefs.hasRun) {
      const confirmed = await confirmFirstRun(this.plugin.app, descriptor);
      if (!confirmed) return;
    }

    let loaded: LoadedScrippet;
    try {
      loaded = await this.loadDescriptorInstance(descriptor);
    } catch (error) {
      this.recordLoadError(descriptor.path, error);
      new Notice(
        `Scrippet "${descriptor.name}" failed to load: ${(error as Error).message ?? String(error)}`,
      );
      return;
    }

    try {
      await loaded.instance.invoke(this.plugin);
      if (!prefs.hasRun) {
        prefs.hasRun = true;
        this.settingsDirty = true;
        await this.flushSettings();
      }
    } catch (error) {
      console.error(`Scrippets: error invoking "${descriptor.name}"`, error);
      new Notice(`Scrippet "${descriptor.name}" failed: ${(error as Error).message ?? error}`);
    }
  }

  private ensurePreference(id: string, path: string): ScriptPreference {
    const scriptStates = this.plugin.settings.scriptStates;
    const idKey = id;
    const pathKey = normalizePath(path);
    const existing = scriptStates[idKey];
    if (existing) return existing;

    const legacy = scriptStates[pathKey];
    if (legacy) {
      delete scriptStates[pathKey];
      scriptStates[idKey] = legacy;
      this.settingsDirty = true;
      return legacy;
    }

    const preference: ScriptPreference = {
      enabled: true,
      hasRun: false,
    };
    scriptStates[idKey] = preference;
    this.settingsDirty = true;
    return preference;
  }

  private async ensureFolders(): Promise<void> {
    const adapter = this.plugin.app.vault.adapter;
    await ensureFolder(adapter, this.baseFolder);
    await ensureFolder(adapter, this.startupFolder);
  }

  private registerCommand(descriptor: ScrippetDescriptor): void {
    const commandId = `${COMMAND_PREFIX}:${descriptor.id}`;
    if (this.commands.has(descriptor.id)) {
      this.plugin.removeCommand(this.commands.get(descriptor.id)!);
    }
    this.commands.set(descriptor.id, commandId);
    this.plugin.addCommand({
      id: commandId,
      name: descriptor.name,
      callback: () => {
        void this.executeById(descriptor.id);
      },
    });
  }

  private unregisterCommand(id: string): void {
    const commandId = this.commands.get(id);
    if (!commandId) return;
    this.plugin.removeCommand(commandId);
    this.commands.delete(id);
  }

  private unregisterCommands(): void {
    this.commands.forEach((commandId) => {
      this.plugin.removeCommand(commandId);
    });
    this.commands.clear();
  }

  private async executeStartup(descriptors: ScrippetDescriptor[]): Promise<void> {
    let updated = false;
    for (const descriptor of descriptors) {
      const prefs = this.plugin.settings.scriptStates[descriptor.id];
      if (prefs && !prefs.enabled) continue;
      try {
        const loaded = await this.loadDescriptorInstance(descriptor);
        await loaded.instance.invoke(this.plugin);
        if (!prefs) {
          this.plugin.settings.scriptStates[descriptor.id] = {
            enabled: true,
            hasRun: true,
          };
          this.settingsDirty = true;
          updated = true;
        } else if (!prefs.hasRun) {
          prefs.hasRun = true;
          this.settingsDirty = true;
          updated = true;
        }
      } catch (error) {
        this.recordLoadError(descriptor.path, error);
        console.error(`Scrippets: startup scrippet failed for ${descriptor.name}`, error);
        new Notice(
          `Startup scrippet "${descriptor.name}" failed: ${(error as Error).message ?? String(error)}`,
        );
      }
    }
    if (updated) {
      await this.flushSettings();
    }
  }

  private async loadDescriptorInstance(descriptor: ScrippetDescriptor): Promise<LoadedScrippet> {
    const cached = this.instanceCache.get(descriptor.id);
    if (cached) return cached;
    const adapter = this.plugin.app.vault.adapter;
    const source = await adapter.read(descriptor.path);
    const instance = loadScrippet(this.plugin, appendSourceUrl(source, descriptor.path));
    const loaded: LoadedScrippet = {
      ...descriptor,
      instance,
    };
    this.instanceCache.set(descriptor.id, loaded);
    this.errorMap.delete(descriptor.path);
    this.updateLastScan();
    this.notify();
    return loaded;
  }

  private recordLoadError(path: string, error: unknown): void {
    this.errorMap.set(path, (error as Error).message ?? String(error));
    this.updateLastScan();
    this.notify();
  }

  private async scanScrippets(): Promise<ScrippetScanResult> {
    const commandFiles = await this.listJsFiles(this.baseFolder, (path) => !isWithin(path, this.startupFolder));
    const startupFiles = await this.listJsFiles(this.startupFolder);

    const errors: ScrippetLoadError[] = [];
    const skipped: string[] = [];
    const commandDescriptors: ScrippetDescriptor[] = [];
    const startupDescriptors: ScrippetDescriptor[] = [];
    const processedIds = new Set<string>();

    await Promise.all(
      commandFiles.map(async (path) => {
        const descriptor = await this.tryBuildDescriptor(path, "command", processedIds, errors, skipped);
        if (descriptor) commandDescriptors.push(descriptor);
      }),
    );

    await Promise.all(
      startupFiles.map(async (path) => {
        const descriptor = await this.tryBuildDescriptor(path, "startup", processedIds, errors, skipped);
        if (descriptor) startupDescriptors.push(descriptor);
      }),
    );

    commandDescriptors.sort(sortByName);
    startupDescriptors.sort(sortByName);

    return {
      commands: commandDescriptors,
      startup: startupDescriptors,
      errors,
      skipped,
    };
  }

  private async tryBuildDescriptor(
    path: string,
    kind: ScrippetKind,
    processedIds: Set<string>,
    errors: ScrippetLoadError[],
    skipped: string[],
  ): Promise<ScrippetDescriptor | null> {
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
      const preference = this.ensurePreference(id, path);

      const descriptor: ScrippetDescriptor = {
        id,
        name,
        description,
        path,
        kind,
        metadata,
        enabled: preference.enabled,
        headerSnippet: buildHeaderSnippet(src),
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
    this.plugin.registerEvent(
      vault.on("create", (file) => this.handleFileChange(file, "changed")),
    );
    this.plugin.registerEvent(
      vault.on("modify", (file) => this.handleFileChange(file, "changed")),
    );
    this.plugin.registerEvent(
      vault.on("delete", (file) => this.handleFileChange(file, "deleted")),
    );
    this.plugin.registerEvent(
      vault.on("rename", (file, oldPath) => {
        if (!(file instanceof TFile)) {
          if (this.isManagedPath(oldPath) || this.isManagedPath(file.path)) {
            this.queueChange({ type: "full" });
          }
          return;
        }
        if (this.isManagedPath(oldPath)) {
          this.queueChange({ type: "deleted", path: oldPath });
        }
        if (this.isManagedPath(file.path)) {
          this.queueChange({ type: "changed", path: file.path });
        }
      }),
    );
  }

  private handleFileChange(file: TAbstractFile, type: "changed" | "deleted"): void {
    if (!(file instanceof TFile)) return;
    if (!this.isManagedPath(file.path)) return;
    this.queueChange({ type, path: file.path });
  }

  private isManagedPath(path: string): boolean {
    const normalized = normalizePath(path);
    return isWithin(normalized, this.baseFolder) || isWithin(normalized, this.startupFolder);
  }

  private queueChange(change: QueuedChange): void {
    this.registerChange(change);
    if (this.reloadTimer == null) {
      this.reloadTimer = window.setTimeout(() => {
        this.reloadTimer = null;
        void this.processPendingChanges();
      }, 200);
    }
  }

  private registerChange(change: QueuedChange): void {
    if (change.type === "full") {
      this.pendingChanges.full = true;
      this.pendingChanges.changed.clear();
      this.pendingChanges.deleted.clear();
      return;
    }
    if (this.pendingChanges.full) return;
    if (!change.path) return;
    const normalized = normalizePath(change.path);
    if (change.type === "deleted") {
      this.pendingChanges.deleted.add(normalized);
      this.pendingChanges.changed.delete(normalized);
    } else {
      if (!this.pendingChanges.deleted.has(normalized)) {
        this.pendingChanges.changed.add(normalized);
      }
    }
  }

  private async processPendingChanges(): Promise<void> {
    const changes = this.pendingChanges;
    this.pendingChanges = createPendingChanges();

    if (changes.full) {
      await this.performFullReload({ runStartup: false });
      return;
    }

    const deletions = Array.from(changes.deleted);
    const updates = Array.from(changes.changed);

    for (const path of deletions) {
      this.removeDescriptor(path);
    }

    for (const path of updates) {
      await this.refreshDescriptor(path);
    }

    await this.flushSettings();
    this.updateLastScan();
    this.notify();
  }

  private removeDescriptor(path: string): void {
    const normalized = normalizePath(path);
    const descriptor = this.descriptorsByPath.get(normalized);
    if (!descriptor) return;
    this.descriptorsByPath.delete(normalized);
    this.descriptorsById.delete(descriptor.id);
    this.instanceCache.delete(descriptor.id);
    this.unregisterCommand(descriptor.id);
    this.errorMap.delete(normalized);
    this.skipped.delete(normalized);
  }

  private async refreshDescriptor(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (!normalized.toLowerCase().endsWith(".js")) {
      this.removeDescriptor(normalized);
      return;
    }

    const kind = this.resolveKind(normalized);
    if (!kind) {
      this.removeDescriptor(normalized);
      return;
    }

    const existing = this.descriptorsByPath.get(normalized);
    try {
      const descriptor = await this.createDescriptor(normalized, kind);
      if (existing && existing.id !== descriptor.id) {
        this.descriptorsById.delete(existing.id);
        this.instanceCache.delete(existing.id);
        this.unregisterCommand(existing.id);
      }

      const duplicate = this.descriptorsById.get(descriptor.id);
      if (duplicate && duplicate.path !== normalized) {
        this.descriptorsByPath.delete(normalized);
        this.errorMap.set(normalized, `Duplicate scrippet id "${descriptor.id}"`);
        this.skipped.add(normalized);
        return;
      }

      this.descriptorsByPath.set(normalized, descriptor);
      this.descriptorsById.set(descriptor.id, descriptor);
      this.instanceCache.delete(descriptor.id);
      this.errorMap.delete(normalized);
      this.skipped.delete(normalized);

      if (descriptor.kind === "command") {
        if (descriptor.enabled) this.registerCommand(descriptor);
        else this.unregisterCommand(descriptor.id);
      }
    } catch (error) {
      this.descriptorsByPath.delete(normalized);
      if (existing) {
        this.descriptorsById.delete(existing.id);
        this.instanceCache.delete(existing.id);
        this.unregisterCommand(existing.id);
      }
      this.errorMap.set(normalized, (error as Error).message ?? String(error));
    }
  }

  private resolveKind(path: string): ScrippetKind | null {
    if (isWithin(path, this.startupFolder)) return "startup";
    if (isWithin(path, this.baseFolder)) return "command";
    return null;
  }

  private async createDescriptor(path: string, kind: ScrippetKind): Promise<ScrippetDescriptor> {
    const adapter = this.plugin.app.vault.adapter;
    const src = await adapter.read(path);
    const { metadata } = parseScrippetMetadata(src);
    const id = toIdentifier(path, metadata);
    if (!id) throw new Error("Unable to derive scrippet id");
    const name = toDisplayName(path, metadata);
    const description = metadata.description ?? metadata.desc;
    const preference = this.ensurePreference(id, path);
    return {
      id,
      name,
      description,
      path,
      kind,
      metadata,
      enabled: preference.enabled,
      headerSnippet: buildHeaderSnippet(src),
    };
  }

  private updateLastScan(): void {
    const descriptors = Array.from(this.descriptorsByPath.values());
    const commands = descriptors.filter((descriptor) => descriptor.kind === "command").sort(sortByName);
    const startup = descriptors.filter((descriptor) => descriptor.kind === "startup").sort(sortByName);
    const errors = Array.from(this.errorMap.entries())
      .map(([path, message]) => ({ path, message }))
      .sort((a, b) => a.path.localeCompare(b.path));
    const skipped = Array.from(this.skipped.values()).sort();
    this.lastScan = { commands, startup, errors, skipped };
  }

  private async flushSettings(): Promise<void> {
    if (!this.settingsDirty) return;
    this.settingsDirty = false;
    await this.plugin.saveSettings();
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

function appendSourceUrl(source: string, path: string): string {
  const normalized = normalizePath(path);
  const marker = "//# sourceURL=";
  if (source.includes(marker)) return source;
  return `${source}\n${marker}<vault>/${normalized}`;
}
