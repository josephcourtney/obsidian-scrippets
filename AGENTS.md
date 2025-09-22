## Purpose

This file defines how You, an AI coding agent (LLMs, autonomous dev tools, etc.), must operate when contributing to this project.

## Role

Your responsibilities include:

- Editing TypeScript source files under `src/`
- Maintaining UI components under `src/ui/`
- Preserving determinism, testability, and extensibility in scrippet execution
- Respecting existing plugin lifecycle and Obsidian API conventions
- Updating `manifest.json`, `package.json`, `versions.json`, and `CHANGELOG.md` consistently for releases

---

## Project Overview

- Target: Obsidian Scrippets plugin (TypeScript → bundled JavaScript).
- Entry point: `src/main.ts`, bundled to `main.js` and loaded by Obsidian.
- Release artifacts: `main.js`, `manifest.json`, and optional `styles.css` at the plugin root.

---

## Directory Constraints

- Source code: `src/`
- UI components: `src/ui/`
- Examples: `examples/`
- Release artifacts: `manifest.json`, `styles.css`, `versions.json`, `CHANGELOG.md`
- Do not commit or modify: `node_modules/`, `main.js`, or other build outputs

---

## Environment & Tooling

- Node.js: current LTS (≥ 18).
- Package manager: **npm**.
- Bundler: **esbuild** via `esbuild.config.mjs`.
- Type definitions: `obsidian@1.8.7` pinned in `devDependencies`.

### Install / Build

```bash
npm install          # install dependencies
npm run dev          # watch + rebuild
npm run build        # tsc --noEmit (TS 5) + esbuild production bundle
```

### Linting

```bash
npx eslint ./src
```

Rules defined in `eslint.config.mjs`.

---

## Tooling Requirements

- `npm run build` must pass with no type errors.
- `npx eslint ./src` must pass.
- Do not add dependencies without inline justification.

---

## Behavior Constraints

- Use Obsidian vault adapter APIs (`adapter.list/read/create`) instead of `fs`.
- Always normalize paths with `normalizePath`.
- Keep metadata parsing deterministic (`@id`, `@name`, `@desc`).
- Surface errors via `Notice`; never fail silently.
- Avoid blocking `onload`; always use async vault I/O.
- Debounce file-system events to avoid redundant reloads.
- Do not introduce non-determinism (e.g., random startup execution unless explicitly toggled).

---

## Source Layout & Conventions

- `src/main.ts`: lifecycle only (load settings, wire up manager, register UI).
- `scrippet-manager.ts`: vault loader, metadata parsing, commands, hot reload.
- `scrippet-loader.ts`: sandboxed evaluator (`new Function`), supports CommonJS/class/`invoke`.
- `metadata.ts`: directive parsing (`@name`, `@id`, `@desc`).
- `types.ts`: shared types and settings defaults.
- `ui/`: settings tab, modals, dialogs.
- `examples/`: valid export shapes.
- `styles.css`: scoped notices, warnings, modals.

---

## Manifest Rules (`manifest.json`)

- Required keys: `id`, `name`, `version`, `minAppVersion`, `description`, `isDesktopOnly`.
- Keep `minAppVersion` aligned with tested APIs (currently `1.5.0`).
- Never change `id` after release.
- Ensure versions in `manifest.json`, `package.json`, `versions.json` match.

---

## Logging & Progress Tracking

### Changelog Maintenance

Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

- Example heading: `## [1.2.3] - 2025-09-22`
- Allowed sections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`
- Each bullet:

  - Lowercase imperative verb (e.g., “add”, “fix”)
  - Markdown syntax

Ensure:

- `CHANGELOG.md` reflects code changes
- Versions updated in `manifest.json`, `package.json`, `versions.json`
- Historical entries never modified

---

## Commit Standards

- All commits must pass `npm run build` and `npx eslint ./src`.
- Use conventional commits:

  - `feat: add startup toggle to settings`
  - `fix: debounce file reload events`
  - `refactor: extract metadata parser`
- Before a release:

  - Bump versions in `manifest.json`, `package.json`, `versions.json`
  - Update `CHANGELOG.md`

---

## Versioning & Releases

- Update `CHANGELOG.md` and append to `versions.json`.
- Run `npm run build` before packaging.
- Release artifacts: `main.js`, `manifest.json`, `styles.css`.
- Tag release with version `x.y.z`.

---

## Security & Compliance

- Scrippets execute arbitrary JavaScript → warnings required in UI and docs.
- No telemetry or network access without explicit opt-in.
- Register all event listeners/intervals via plugin helpers for cleanup.

---

## Performance Guidelines

- Avoid blocking `onload`; use async and `Promise.all` batching.
- Debounce reload events.
- Defer startup script execution unless user enables it.

---

## Prohibited Behavior

- Do not commit `main.js` or `node_modules/`.
- Do not modify `manifest.json.id`.
- Do not reduce or silence warnings about unsafe scripts.
- Do not bypass vault adapter APIs.
- Do not introduce non-determinism in scrippet loading.

---

## Assumptions & Compliance

- Each task starts with only the current repo state.
- Always re-read `CHANGELOG.md`, `manifest.json`, and `versions.json` before modifying.
- If lacking shell/build execution:

  - Emit Markdown patch with proposed edits.
  - Describe expected outputs of toolchain commands.
  - Wait for user confirmation before proceeding.

---

# Appendix A — Sample Operations

### Create a scrippet programmatically

```ts
import { normalizePath, Notice } from "obsidian";
import type ScrippetPlugin from "src/main";

export async function createDemo(plugin: ScrippetPlugin) {
  const target = normalizePath(`${plugin.settings.folder}/demo.js`);
  if (await plugin.app.vault.adapter.exists(target)) return;

  const template = `/* @name: Demo @id: demo */\nmodule.exports = {\n  async invoke(plugin) {\n    new Notice('Demo ran');\n  },\n};\n`;

  await plugin.app.vault.create(target, template);
  await plugin.manager.reload({ runStartup: false });
}
```

### Refresh the loader manually

```ts
await plugin.manager.reload({ runStartup: plugin.settings.runStartupOnLoad });
```

---

# Appendix B — Troubleshooting

- **Missing commands:** ensure metadata IDs are unique; duplicates appear in settings under “Skipped”.
- **Startup failures:** errors appear as Notices and in the log; loading continues after failures.
- **Build errors:** run `npm run build`; confirm `tsconfig.json` points to `src/**/*.ts`.
- **Mobile:** set `isDesktopOnly` to `false`; avoid desktop APIs.

---

## References

- [Obsidian API docs](https://docs.obsidian.md)
- [Obsidian sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Developer policies](https://docs.obsidian.md/Developer+policies)
- [Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [Style guide](https://help.obsidian.md/style-guide)
