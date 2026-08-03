import { Notice, type Plugin } from "obsidian";
import { evaluateScrippetSource } from "./scrippet-runtime";
import type { ScrippetModule } from "./types";

export function loadScrippet(plugin: Plugin, source: string): ScrippetModule {
  const mod = evaluateScrippetSource(plugin, plugin.app, Notice, source);
  const instance = typeof mod === "function" ? new (mod as new (plugin: Plugin) => unknown)(plugin) : mod;
  if (!isScrippetModule(instance)) {
    throw new Error("Scrippet must expose invoke(plugin)");
  }
  return instance;
}

function isScrippetModule(candidate: unknown): candidate is ScrippetModule {
  if (!candidate || typeof candidate !== "object") return false;
  const invoke = (candidate as Record<string, unknown>).invoke;
  return typeof invoke === "function";
}
