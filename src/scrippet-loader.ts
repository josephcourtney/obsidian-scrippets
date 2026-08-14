import { Notice, normalizePath, type Plugin } from "obsidian";
import { parseScrippetMetadata } from "./metadata";
import { getRequiredSnippetId } from "./snippet-dependency";
import { evaluateScrippetSource } from "./scrippet-runtime";
import type { ScrippetModule } from "./types";

export function loadScrippet(plugin: Plugin, source: string): ScrippetModule {
  const { metadata } = parseScrippetMetadata(source);
  const requiredSnippetId = getRequiredSnippetId(metadata);
  const mod = evaluateScrippetSource(plugin, plugin.app, Notice, source);
  const instance = typeof mod === "function" ? new (mod as new (plugin: Plugin) => unknown)(plugin) : mod;
  if (!isScrippetModule(instance)) {
    throw new Error("Scrippet must expose invoke(plugin)");
  }
  if (!requiredSnippetId) return instance;

  return withSnippetDependency(instance, requiredSnippetId);
}

function withSnippetDependency(instance: ScrippetModule, snippetId: string): ScrippetModule {
  return {
    invoke: async (plugin) => {
      const snippetPath = normalizePath(
        `${plugin.app.vault.configDir}/snippets/${snippetId}.css`,
      );
      const exists = await plugin.app.vault.adapter.exists(snippetPath);
      if (!exists) {
        throw new Error(
          `Required CSS snippet "${snippetId}" was not found at "${snippetPath}".`,
        );
      }

      return instance.invoke(plugin);
    },
  };
}

function isScrippetModule(candidate: unknown): candidate is ScrippetModule {
  if (!candidate || typeof candidate !== "object") return false;
  const invoke = (candidate as Record<string, unknown>).invoke;
  return typeof invoke === "function";
}
