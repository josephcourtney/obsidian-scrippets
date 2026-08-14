import { TFile, normalizePath, type Plugin, type TAbstractFile } from "obsidian";
import {
  coerceScrippetParameterValue,
  parseScrippetParameterSchema,
} from "./parameters";
import { SerialTaskQueue } from "./serial-task-queue";
import type {
  CssSnippetParameterDefinition,
  CssSnippetParameterSchema,
  CssSnippetParameterSource,
  ScrippetParameterValues,
} from "./types";

const ANNOTATED_CUSTOM_PROPERTY =
  /\/\*([\s\S]*?@scrippets-setting[\s\S]*?)\*\/\s*(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+);/g;
const CSS_CUSTOM_PROPERTY = /^--scrippets-[A-Za-z0-9_-]+$/;
const CSS_NUMBER = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))([A-Za-z%][A-Za-z0-9%_-]*)?$/;
const ANNOTATION_FIELDS = new Set([
  "label",
  "description",
  "desc",
  "min",
  "max",
  "step",
  "control",
  "key",
]);

interface CssDimension {
  value: number;
  unit: string;
}

export class CssSnippetParameterCatalog {
  private readonly queue = new SerialTaskQueue();
  private readonly sources = new Map<string, CssSnippetParameterSource>();
  private readonly listeners = new Set<() => void>();
  private plugin?: Plugin;
  private initialized = false;
  private disposed = false;

  get(id: string): CssSnippetParameterSource | undefined {
    return this.sources.get(normalizeSnippetId(id));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async initialize(plugin: Plugin): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.plugin = plugin;
    await this.queue.run(() => this.scanAll());
    this.registerWatchers(plugin);
  }

  destroy(): void {
    this.disposed = true;
    this.listeners.clear();
    this.sources.clear();
  }

  private get snippetsFolder(): string {
    const plugin = this.plugin;
    if (!plugin) return "";
    return normalizePath(`${plugin.app.vault.configDir}/snippets`);
  }

  private async scanAll(): Promise<void> {
    const plugin = this.plugin;
    if (!plugin || this.disposed) return;

    const next = new Map<string, CssSnippetParameterSource>();
    try {
      const listing = await plugin.app.vault.adapter.list(this.snippetsFolder);
      for (const path of listing.files
        .map((file) => normalizePath(file))
        .filter((file) => file.toLowerCase().endsWith(".css"))
        .sort((a, b) => a.localeCompare(b))) {
        const source = await this.readSource(path);
        next.set(source.id, source);
      }
    } catch (error) {
      console.debug(`Scrippets: unable to list ${this.snippetsFolder}`, error);
    }

    this.sources.clear();
    for (const [id, source] of next) this.sources.set(id, source);
    this.notify();
  }

  private async refreshPath(path: string): Promise<void> {
    if (this.disposed || !this.isSnippetPath(path)) return;
    const plugin = this.plugin;
    if (!plugin) return;

    const normalized = normalizePath(path);
    const id = snippetIdFromPath(normalized);
    const exists = await plugin.app.vault.adapter.exists(normalized);
    if (!exists) {
      this.sources.delete(id);
      this.notify();
      return;
    }

    this.sources.set(id, await this.readSource(normalized));
    this.notify();
  }

  private async readSource(path: string): Promise<CssSnippetParameterSource> {
    const plugin = this.plugin;
    if (!plugin) throw new Error("CSS snippet catalog is not initialized.");

    const normalized = normalizePath(path);
    const id = snippetIdFromPath(normalized);
    try {
      const source = await plugin.app.vault.adapter.read(normalized);
      const settings = parseCssSnippetParameterSchema(source, id);
      return {
        id,
        path: normalized,
        ...(settings ? { settings } : {}),
      };
    } catch (error) {
      return {
        id,
        path: normalized,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private registerWatchers(plugin: Plugin): void {
    const vault = plugin.app.vault;
    plugin.registerEvent(vault.on("create", (file) => this.handleFileChange(file)));
    plugin.registerEvent(vault.on("modify", (file) => this.handleFileChange(file)));
    plugin.registerEvent(vault.on("delete", (file) => this.handleFileChange(file)));
    plugin.registerEvent(
      vault.on("rename", (file, oldPath) => {
        if (!this.isSnippetPath(oldPath) && !this.isSnippetPath(file.path)) return;
        void this.queue.run(async () => {
          if (!(file instanceof TFile)) {
            await this.scanAll();
            return;
          }
          const oldId = snippetIdFromPath(oldPath);
          if (this.isSnippetPath(oldPath)) this.sources.delete(oldId);
          if (this.isSnippetPath(file.path)) await this.refreshPath(file.path);
          else this.notify();
        });
      }),
    );
  }

  private handleFileChange(file: TAbstractFile): void {
    if (!(file instanceof TFile) || !this.isSnippetPath(file.path)) return;
    void this.queue.run(() => this.refreshPath(file.path));
  }

  private isSnippetPath(path: string): boolean {
    if (!this.snippetsFolder) return false;
    const normalized = normalizePath(path);
    return normalized.toLowerCase().endsWith(".css") && isWithin(normalized, this.snippetsFolder);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export function parseCssSnippetParameterSchema(
  source: string,
  snippetId: string,
): CssSnippetParameterSchema | undefined {
  const schema: CssSnippetParameterSchema = {};
  const runtimeKeys = new Set<string>();
  ANNOTATED_CUSTOM_PROPERTY.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ANNOTATED_CUSTOM_PROPERTY.exec(source)) !== null) {
    const body = match[1] ?? "";
    const cssVar = match[2] ?? "";
    const defaultText = (match[3] ?? "").trim();
    if (!CSS_CUSTOM_PROPERTY.test(cssVar)) {
      throw new Error(
        `CSS snippet setting variable "${cssVar}" must start with --scrippets-.`,
      );
    }
    if (!defaultText) {
      throw new Error(`CSS snippet setting "${cssVar}" must declare a default value.`);
    }

    const metadata = parseAnnotation(body, cssVar);
    const runtimeKey = metadata.key?.trim() || undefined;
    const storageKey = runtimeKey ?? inferStorageKey(snippetId, cssVar);
    if (!storageKey) {
      throw new Error(`Unable to derive a setting key for CSS variable "${cssVar}".`);
    }
    if (schema[storageKey]) {
      throw new Error(`CSS snippet declares duplicate setting key "${storageKey}".`);
    }
    if (runtimeKey) {
      if (runtimeKeys.has(runtimeKey)) {
        throw new Error(`CSS snippet declares duplicate runtime key "${runtimeKey}".`);
      }
      runtimeKeys.add(runtimeKey);
    }

    const rawDefinition = buildRawDefinition(storageKey, cssVar, defaultText, metadata);
    const parsed = parseScrippetParameterSchema({ [storageKey]: rawDefinition });
    const definition = parsed?.[storageKey];
    if (!definition || definition.cssVar === true || typeof definition.cssVar !== "string") {
      throw new Error(`Unable to parse CSS snippet setting "${cssVar}".`);
    }

    schema[storageKey] = {
      ...definition,
      cssVar: definition.cssVar,
      ...(runtimeKey ? { runtimeKey } : {}),
    };
  }

  return Object.keys(schema).length > 0 ? schema : undefined;
}

export function resolveCssSnippetRuntimeValues(
  schema: CssSnippetParameterSchema | undefined,
  saved: ScrippetParameterValues | undefined,
): ScrippetParameterValues {
  const values: ScrippetParameterValues = {};
  if (!schema) return values;

  for (const [storageKey, definition] of Object.entries(schema)) {
    const runtimeKey = definition.runtimeKey;
    if (!runtimeKey) continue;
    const raw = saved?.[storageKey];
    if (raw === undefined) {
      values[runtimeKey] = definition.default;
      continue;
    }
    try {
      values[runtimeKey] = coerceScrippetParameterValue(definition, raw);
    } catch {
      values[runtimeKey] = definition.default;
    }
  }
  return values;
}

function buildRawDefinition(
  storageKey: string,
  cssVar: string,
  defaultText: string,
  metadata: Record<string, string>,
): Record<string, unknown> {
  const label = metadata.label?.trim() || humanize(storageKey);
  const description = metadata.description?.trim() || metadata.desc?.trim() || undefined;
  const numericDefault = parseCssDimension(defaultText);

  if (!numericDefault) {
    if (metadata.min || metadata.max || metadata.step || metadata.control) {
      throw new Error(
        `CSS snippet setting "${cssVar}" can only use min, max, step, or control when its default is numeric.`,
      );
    }
    return {
      type: "string",
      label,
      ...(description ? { description } : {}),
      default: defaultText,
      "css-var": cssVar,
    };
  }

  return {
    type: "number",
    label,
    ...(description ? { description } : {}),
    default: numericDefault.value,
    ...(numericDefault.unit ? { unit: numericDefault.unit } : {}),
    ...(metadata.min
      ? { min: parseBound(metadata.min, numericDefault.unit, `${cssVar}.min`) }
      : {}),
    ...(metadata.max
      ? { max: parseBound(metadata.max, numericDefault.unit, `${cssVar}.max`) }
      : {}),
    ...(metadata.step
      ? { step: parseBound(metadata.step, numericDefault.unit, `${cssVar}.step`) }
      : {}),
    ...(metadata.control ? { control: metadata.control.trim() } : {}),
    "css-var": cssVar,
  };
}

function parseAnnotation(body: string, cssVar: string): Record<string, string> {
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*\s?/, "").trimEnd());
  const markerIndex = lines.findIndex((line) => line.trim() === "@scrippets-setting");
  if (markerIndex < 0) return {};

  const metadata: Record<string, string> = {};
  for (const line of lines.slice(markerIndex + 1)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf(":");
    if (separator <= 0) {
      throw new Error(
        `CSS snippet setting "${cssVar}" metadata line "${trimmed}" must use key: value syntax.`,
      );
    }
    const key = trimmed.slice(0, separator).trim().toLowerCase();
    const value = trimmed.slice(separator + 1).trim();
    if (!ANNOTATION_FIELDS.has(key)) {
      throw new Error(`CSS snippet setting "${cssVar}" has unknown metadata field "${key}".`);
    }
    if (!value) {
      throw new Error(`CSS snippet setting "${cssVar}" field "${key}" cannot be empty.`);
    }
    metadata[key] = value;
  }
  return metadata;
}

function parseCssDimension(raw: string): CssDimension | null {
  const match = CSS_NUMBER.exec(raw.trim());
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return { value, unit: match[2] ?? "" };
}

function parseBound(raw: string, expectedUnit: string, path: string): number {
  const parsed = parseCssDimension(raw);
  if (!parsed) {
    throw new Error(`CSS snippet setting "${path}" must be a numeric value.`);
  }
  if (parsed.unit && parsed.unit !== expectedUnit) {
    throw new Error(
      `CSS snippet setting "${path}" uses unit "${parsed.unit}" but the custom property uses "${expectedUnit || "no unit"}".`,
    );
  }
  if (!expectedUnit && parsed.unit) {
    throw new Error(`CSS snippet setting "${path}" cannot add a unit to a unitless default.`);
  }
  return parsed.value;
}

function inferStorageKey(snippetId: string, cssVar: string): string {
  const idPart = toCssNamePart(snippetId);
  const scopedPrefix = idPart ? `--scrippets-${idPart}-` : "";
  const raw =
    scopedPrefix && cssVar.startsWith(scopedPrefix)
      ? cssVar.slice(scopedPrefix.length)
      : cssVar.slice("--scrippets-".length);
  return raw.trim();
}

function snippetIdFromPath(path: string): string {
  const normalized = normalizePath(path);
  const filename = normalized.split("/").pop() ?? normalized;
  return normalizeSnippetId(filename);
}

function normalizeSnippetId(value: string): string {
  const trimmed = value.trim();
  return trimmed.toLowerCase().endsWith(".css") ? trimmed.slice(0, -4) : trimmed;
}

function humanize(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function toCssNamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isWithin(path: string, folder: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedFolder = normalizePath(folder).replace(/\/$/, "");
  return normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}/`);
}
