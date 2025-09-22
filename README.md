# Obsidian Scrippets

Obsidian Scrippets lets you author small JavaScript “scrippets” right inside your vault. The plugin discovers files, parses optional metadata, and registers them as commands or opt-in startup jobs without requiring a build step.

## Features

- Works on desktop and mobile using the Obsidian vault adapter (no `fs` dependency).
- Configurable scrippet folder with live reload on file create, modify, rename, or delete.
- Automatic metadata parsing from header comments for stable IDs, names, and descriptions.
- Per-scrippet enable/disable switches, first-run confirmation, and manual run buttons.
- Startup folder support with explicit opt-in and per-file toggles.
- Settings UI to pick the folder, reload, inspect load errors, and add new templates.

## Security

Scrippets execute with the same privileges as Obsidian. They can read, write, or delete any file in your vault and interact with the DOM. Only install scripts you trust, review the source, and enable **Run startup scripts at launch** only when you accept that the code runs automatically on every load.

## Scrippet structure

Scrippets live in `/<vault>/<folder>/*.js`. The default folder is `.obsidian/scrippets/`. Startup scrippets go into the `startup/` sub-folder.

Each file must expose an `invoke(plugin)` function. Three export shapes are supported:

```js
/* @name: Toggle Wrap @id: toggle-wrap @desc: Toggle the nowrap snippet */
class ToggleWrap {
  async invoke(plugin) {
    const { app } = plugin;
    const snippets = app.customCss.enabledSnippets;
    const enabled = snippets.has("nowrap");
    app.customCss.setCssEnabledStatus("nowrap", !enabled);
  }
}
```

```js
/* @name: Daily Notice @id: daily-notice */
module.exports = class DailyNotice {
  async invoke(plugin) {
    await plugin.app.workspace.onLayoutReady(() => {
      new Notice("Remember to review your daily note!");
    });
  }
};
```

```js
/* @name: Toast Hello @id: toast-hello */
const invoke = async (plugin) => {
  new Notice(`Hello from ${plugin.manifest.name}!`);
};

module.exports = { invoke };
```

### Metadata directives

An optional block comment at the top of the file can provide directives. Recognised keys are:

- `@name` – display name in settings and the command palette
- `@id` – stable identifier; otherwise derived from the filename
- `@desc` – short description shown in settings

Additional directives are ignored but preserved in the source.

### Startup scripts

Files inside `<folder>/startup/` can run automatically when Obsidian loads. Enable **Run startup scripts at launch** in the settings tab to opt in. Each startup script can also be disabled individually. Errors are surfaced with `Notice` notifications so one failure does not prevent other scripts from running.

## Settings highlights

Open **Settings → Community plugins → Scrippets** to:

- Change the scrippet folder.
- Toggle startup execution, confirm-first-run, and review safety warnings.
- Inspect loaded commands, enable/disable them, and run them manually.
- View load errors or skipped files (e.g., duplicate IDs).
- Add new files via the **+** dialog, including templates for the supported export shapes.

## Installation

1. `npm install`
2. `npm run build`
3. Copy `main.js`, `manifest.json`, and `styles.css` into `<Vault>/.obsidian/plugins/obsidian-scrippets/`.
4. Enable **Scrippets** in **Settings → Community plugins**.

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # type-check + bundle
```

The project uses TypeScript 5, esbuild, and ESLint. Source files live in `src/` and bundle to `main.js`.

## Versioning

- Plugin version lives in `manifest.json` and `package.json`.
- Minimum supported Obsidian version is declared in `manifest.json` and mapped in `versions.json`.
- Use `npm run release` scripts or `npm version` to bump consistently.

See [CHANGELOG.md](./CHANGELOG.md) for a human-readable history of updates.

## Release process

1. Confirm the working tree is clean and the GitHub CLI (`gh`) is authenticated (`gh auth login`).
2. Run `npm run release -- --type=patch` (default) or `--type=minor` / `--type=major` depending on the bump you need.
   - To specify an exact version instead, use `npm run release -- --version=1.2.3`.
3. The release script will build the bundle, run `npm version`, push the branch and tags, and create a GitHub release using the notes from `CHANGELOG.md`.
   - Add `--no-push` to skip pushing, or `--no-publish` to skip the GitHub release step.

## Project structure

```
obsidian-scrippets/
├── src/                # TypeScript sources
│   ├── main.ts         # Plugin entry
│   ├── scrippet-manager.ts
│   ├── metadata.ts
│   └── ui/             # Settings UI and modals
├── esbuild.config.mjs
├── tsconfig.json
├── manifest.json
├── versions.json
├── styles.css
├── scripts/
│   └── release.mjs    # release automation script
└── package.json
```

## References

- [Obsidian API docs](https://docs.obsidian.md)
- [Sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Developer policies](https://docs.obsidian.md/Developer+policies)
