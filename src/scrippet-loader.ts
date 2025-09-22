import { Notice, type Plugin } from "obsidian";
import type { ScrippetModule } from "./types";

export function loadScrippet(plugin: Plugin, source: string): ScrippetModule {
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
  );

  const mod = factory(plugin, plugin.app, Notice);
  const instance = typeof mod === "function" ? new mod(plugin) : mod;
  if (!instance || typeof instance.invoke !== "function") {
    throw new Error("Scrippet must expose invoke(plugin)");
  }
  return instance as ScrippetModule;
}
