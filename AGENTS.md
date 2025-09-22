# Obsidian Scrippets plugin

## Project overview

- Target: Obsidian Scrippets plugin (TypeScript → bundled JavaScript).
- Entry point: `src/main.ts`, bundled to `main.js` and loaded by Obsidian.
- Release artifacts: `main.js`, `manifest.json`, and optional `styles.css` at the plugin root.

## Environment & tooling

- Node.js: use current LTS (≥ 18).
- Package manager: **npm** (scripts defined in `package.json`).
- Bundler: **esbuild** driven by `esbuild.config.mjs`.
- Type definitions: `obsidian@1.8.7` pinned in `devDependencies`.

### Install / build

```bash
npm install          # install dependencies
npm run dev          # watch + rebuild on changes
npm run build        # tsc --noEmit (TS 5) + esbuild production bundle
```

### Linting

```bash
npx eslint ./src
```

Adjust rules in `eslint.config.mjs` if needed.

## Source layout & conventions

- All TypeScript lives in `src/`.
- Keep `src/main.ts` focused on lifecycle (load settings, wire up manager, register UI).
- Core modules:
  - `scrippet-manager.ts`: vault-based loader, metadata parsing, command registration, hot reload.
  - `scrippet-loader.ts`: sandboxed `new Function` evaluator supporting class, CommonJS, or `invoke` exports.
  - `metadata.ts`: comment directive parsing (`@name`, `@id`, `@desc`).
  - `types.ts`: shared types and persisted settings defaults.
  - `ui/`: settings tab, add-scrippet modal, confirmation dialogs.
- Examples demonstrating supported export shapes live in `examples/`.
- `styles.css` holds scoped styling for notices, warnings, and modals.
- Do not commit build outputs (`main.js`) or `node_modules/`.

## Manifest rules (`manifest.json`)

- Required keys: `id`, `name`, `version`, `minAppVersion`, `description`, `isDesktopOnly`.
- Keep `minAppVersion` aligned with tested APIs (currently `1.5.0`).
- Never change `id` after release.
- Ensure versions in `manifest.json`, `package.json`, and `versions.json` match.

## Testing

Manual install by copying artifacts into `<Vault>/.obsidian/plugins/obsidian-scrippets/`, then reload Obsidian and enable the plugin under **Settings → Community plugins**.

## Commands & settings

- Register commands through `ScrippetManager` (per-file commands generated from metadata/filename).
- Persist configuration via `this.loadData()` / `this.saveData()`; settings schema is defined in `types.ts`.
- Settings UI provides folder selection, startup opt-in, per-script toggles, manual run, and creation dialog.

## Versioning & releases

- Bump versions in `manifest.json`, `package.json`, and append to `versions.json`.
- Document changes in `CHANGELOG.md`.
- `npm run build` before packaging; upload `main.js`, `manifest.json`, `styles.css` with the release tag `x.y.z`.

## Security & compliance

- Scrippets execute arbitrary JavaScript; surface warnings in UI and documentation.
- Use vault adapter APIs (`adapter.list/read/create`) instead of desktop-only `fs`.
- No telemetry or network access without explicit opt-in and disclosure.
- Always register event listeners/intervals via plugin helpers to ensure cleanup.

## Performance guidelines

- Avoid blocking `onload`; rely on async vault IO and `Promise.all` batching in `ScrippetManager`.
- Debounce file-system events (see `scheduleReload`) to prevent redundant reloads.
- Defer startup script execution unless the user enables the toggle.

## Coding tips

- TypeScript `strict` mode is enabled; address type errors rather than casting away.
- Prefer `async/await` and wrap user script execution in try/catch to surface errors via `Notice`.
- Keep modules focused and under ~300 lines; break out helpers when necessary.

## Sample operations

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

## Troubleshooting

- Missing commands: ensure metadata IDs are unique; duplicates are reported in the settings UI under “Skipped”.
- Startup failures: errors appear as Notices and in the log; scripts continue loading after failures.
- Build errors: run `npm run build` to type-check and bundle; confirm `tsconfig.json` points to `src/**/*.ts`.
- Mobile: set `isDesktopOnly` to `false` and avoid desktop APIs—already enforced via vault adapter usage.

## References

- [Obsidian API docs](https://docs.obsidian.md)
- [Obsidian sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Developer policies](https://docs.obsidian.md/Developer+policies)
- [Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [Style guide](https://help.obsidian.md/style-guide)
