export type RuntimeFactory = (plugin: unknown, app: unknown, notice: unknown) => unknown;

export function evaluateScrippetSource(
  plugin: unknown,
  app: unknown,
  notice: unknown,
  source: string,
): unknown {
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
const module = { exports: {} };
const initialExports = module.exports;
let exports = module.exports;
${source}
const commonJsExport =
  module.exports !== initialExports || Object.keys(initialExports).length > 0
    ? module.exports
    : undefined;
return commonJsExport
  ?? (typeof Scrippet !== "undefined" ? Scrippet : undefined)
  ?? (typeof defaultExport !== "undefined" ? defaultExport : undefined)
  ?? (typeof invoke === "function" ? { invoke } : undefined)
  ?? (typeof window.Scrippet === "function" ? window.Scrippet : undefined);
    `,
  ) as RuntimeFactory;

  return factory(plugin, app, notice);
}
