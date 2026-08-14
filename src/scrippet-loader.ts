import { Notice, normalizePath, type Plugin } from "obsidian";
import {
  maskScrippetFrontmatter,
  parseScrippetMetadata,
  toIdentifier,
} from "./metadata";
import { resolveScrippetParameterValues } from "./parameters";
import { getRequiredSnippetId } from "./snippet-dependency";
import { evaluateScrippetSource } from "./scrippet-runtime";
import type {
  ScrippetMetadata,
  ScrippetModule,
  ScrippetParameterSchema,
  ScrippetPluginSettings,
} from "./types";

interface ScrippetPluginHost extends Plugin {
  settings?: Partial<ScrippetPluginSettings>;
}

export function loadScrippet(plugin: Plugin, source: string): ScrippetModule {
  const parsed = parseScrippetMetadata(source);
  const { metadata } = parsed;
  const requiredSnippetId = getRequiredSnippetId(metadata);
  const scrippetId = resolveScrippetId(source, metadata);
  const executableSource = maskScrippetFrontmatter(source, parsed);
  const mod = evaluateScrippetSource(plugin, plugin.app, Notice, executableSource);
  const instance = typeof mod === "function" ? new (mod as new (plugin: Plugin) => unknown)(plugin) : mod;
  if (!isScrippetModule(instance)) {
    throw new Error("Scrippet must expose invoke(plugin)");
  }
  if (!requiredSnippetId && !metadata.settings) return instance;

  return withScrippetFeatures(instance, requiredSnippetId, metadata.settings, scrippetId);
}

function withScrippetFeatures(
  instance: ScrippetModule,
  snippetId: string | undefined,
  schema: ScrippetParameterSchema | undefined,
  scrippetId: string | undefined,
): ScrippetModule {
  return {
    invoke: async (plugin) => {
      if (snippetId) {
        const snippetPath = normalizePath(
          `${plugin.app.vault.configDir}/snippets/${snippetId}.css`,
        );
        const exists = await plugin.app.vault.adapter.exists(snippetPath);
        if (!exists) {
          throw new Error(
            `Required CSS snippet "${snippetId}" was not found at "${snippetPath}".`,
          );
        }
      }

      const settings = schema
        ? resolveScrippetParameterValues(schema, getSavedSettings(plugin, scrippetId))
        : undefined;
      return instance.invoke(plugin, settings);
    },
  };
}

function getSavedSettings(plugin: Plugin, scrippetId: string | undefined) {
  if (!scrippetId) return undefined;
  const host = plugin as ScrippetPluginHost;
  return host.settings?.scrippetSettings?.[scrippetId];
}

function resolveScrippetId(source: string, metadata: ScrippetMetadata): string | undefined {
  if (metadata.id) return toIdentifier("", metadata);
  const path = extractSourcePath(source);
  return path ? toIdentifier(path, metadata) : undefined;
}

function extractSourcePath(source: string): string | undefined {
  const match = /\/\/# sourceURL=<vault>\/([^\r\n]+)/.exec(source);
  return match?.[1]?.trim() || undefined;
}

function isScrippetModule(candidate: unknown): candidate is ScrippetModule {
  if (!candidate || typeof candidate !== "object") return false;
  const invoke = (candidate as Record<string, unknown>).invoke;
  return typeof invoke === "function";
}
