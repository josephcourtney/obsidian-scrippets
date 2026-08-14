import type { Plugin } from "obsidian";

export type ScrippetParameterType = "boolean" | "number" | "string" | "select";
export type ScrippetParameterValue = boolean | number | string;

export interface ScrippetParameterOption {
  value: string;
  label: string;
}

export interface ScrippetParameterDefinition {
  type: ScrippetParameterType;
  label: string;
  description?: string;
  default: ScrippetParameterValue;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: ScrippetParameterOption[];
  cssVar?: string;
}

export type ScrippetParameterSchema = Record<string, ScrippetParameterDefinition>;
export type ScrippetParameterValues = Record<string, ScrippetParameterValue>;

export interface ScrippetMetadata {
  [key: string]: string | ScrippetParameterSchema | undefined;
  id?: string;
  name?: string;
  desc?: string;
  description?: string;
  "requires-snippet"?: string;
  settings?: ScrippetParameterSchema;
}

export type ScrippetKind = "command" | "startup";

export interface ScrippetDescriptor {
  id: string;
  name: string;
  description?: string;
  path: string;
  kind: ScrippetKind;
  metadata: ScrippetMetadata;
  enabled: boolean;
  headerSnippet: string;
  modified: number;
}

export interface ScriptPreference {
  enabled: boolean;
  hasRun: boolean;
  startupApproved?: boolean;
}

export type ScrippetExecutionTrigger = "command" | "manual" | "startup";
export type ScrippetExecutionStatus = "success" | "failed";

export interface ScrippetExecutionRecord {
  id: string;
  name: string;
  path: string;
  trigger: ScrippetExecutionTrigger;
  status: ScrippetExecutionStatus;
  startedAt: number;
  durationMs: number;
  error?: string;
}

export interface ScrippetPluginSettings {
  folder: string;
  runStartupOnLoad: boolean;
  confirmBeforeFirstRun: boolean;
  scriptStates: Record<string, ScriptPreference>;
  scrippetSettings: Record<string, ScrippetParameterValues>;
  startupAcknowledged: boolean;
  allowedExtensions: string[];
  listSort: ScrippetListSort;
  trustedFolders: string[];
}

export const DEFAULT_SETTINGS: ScrippetPluginSettings = {
  folder: ".obsidian/scrippets",
  runStartupOnLoad: false,
  confirmBeforeFirstRun: true,
  scriptStates: {},
  scrippetSettings: {},
  startupAcknowledged: false,
  allowedExtensions: [".js", ".cjs"],
  listSort: { field: "name", direction: "asc" },
  trustedFolders: [],
};

export interface ScrippetModule {
  invoke: (
    plugin: Plugin,
    settings?: Readonly<ScrippetParameterValues>,
  ) => void | Promise<unknown>;
}

export interface LoadedScrippet extends ScrippetDescriptor {
  instance: ScrippetModule;
}

export interface ScrippetLoadError {
  path: string;
  message: string;
}

export interface ScrippetDuplicate {
  path: string;
  id: string;
  suggestion: string;
}

export interface ScrippetScanResult {
  commands: ScrippetDescriptor[];
  startup: ScrippetDescriptor[];
  errors: ScrippetLoadError[];
  duplicates: ScrippetDuplicate[];
}

export type ScrippetSortField = "name" | "modified" | "enabled";

export interface ScrippetListSort {
  field: ScrippetSortField;
  direction: "asc" | "desc";
}
