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
  source: string;
  metadata: ScrippetMetadata;
  enabled: boolean;
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
}

export const DEFAULT_SETTINGS: ScrippetPluginSettings = {
  folder: ".obsidian/scrippets",
  runStartupOnLoad: false,
  confirmBeforeFirstRun: true,
  scriptStates: {},
  startupAcknowledged: false,
};

export interface ScrippetModule {
  invoke: (plugin: Plugin) => unknown | Promise<unknown>;
}

export interface LoadedScrippet extends ScrippetDescriptor {
  instance: ScrippetModule;
}

export interface ScrippetLoadError {
  path: string;
  message: string;
}

export interface ScrippetScanResult {
  commands: LoadedScrippet[];
  startup: LoadedScrippet[];
  errors: ScrippetLoadError[];
  skipped: string[];
}
