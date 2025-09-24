import { Notice, type Plugin } from "obsidian";
import type { ScrippetModule } from "./types";

type ModuleFactory = (plugin: Plugin, app: Plugin["app"], notice: typeof Notice) => unknown;

export function loadScrippet(plugin: Plugin, source: string): ScrippetModule {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(
    "plugin",
    "app",
    "Notice",
    `"use strict";
const sandbox = Object.create(null);
sandbox.app = app;
sandbox.Notice = Notice;
sandbox.plugin = plugin;
const window = sandbox;
const global = sandbox;
const globalThis = sandbox;
const self = sandbox;
let module = { exports: {} };
let exports = module.exports;
let Scrippet;
let defaultExport;
let invoke;
${source}
return (typeof module !== 'undefined' && module.exports)
  || (typeof exports !== 'undefined' && exports)
  || (typeof Scrippet !== 'undefined' && Scrippet)
  || (typeof defaultExport !== 'undefined' && defaultExport)
  || (typeof invoke === 'function' && { invoke })
  || (typeof window.Scrippet === 'function' && window.Scrippet)
  ;
    `,
  ) as ModuleFactory;

  const mod = factory(plugin, plugin.app, Notice);
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
