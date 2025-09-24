import type { Plugin } from "obsidian";

export interface ScrippetMetadata {
  id?: string;
  name?: string;
  desc?: string;
  description?: string;
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
}

export interface ScrippetPluginSettings {
  folder: string;
  runStartupOnLoad: boolean;
  confirmBeforeFirstRun: boolean;
  scriptStates: Record<string, ScriptPreference>;
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
  startupAcknowledged: false,
  allowedExtensions: [".js", ".mjs", ".cjs"],
  listSort: { field: "name", direction: "asc" },
  trustedFolders: [],
};

export interface ScrippetModule {
  invoke: (plugin: Plugin) => void | Promise<unknown>;
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
