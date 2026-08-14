# Obsidian Scrippets

Obsidian Scrippets lets you author small JavaScript “scrippets” right inside your vault. The plugin discovers files, parses optional metadata, and registers them as commands or opt-in startup jobs without requiring a build step.

## Features

- Works on desktop and mobile using the Obsidian vault adapter (no `fs` dependency).
- Configurable scrippet folder under the vault config directory with live reload on file create, modify, rename, or delete.
- Metadata from header comments or YAML frontmatter for stable IDs, names, descriptions, CSS snippet dependencies, and configurable parameters.
- Per-scrippet enable/disable switches, first-run confirmation, manual run buttons, and persisted parameter values.
- Typed parameter controls for booleans, numbers, strings, and select menus in the Scrippets settings panel.
- Optional CSS custom-property bindings so parameters can configure dependent CSS snippets without rewriting snippet files.
- Startup folder support with explicit opt-in, per-file toggles, and one-time approval for untrusted startup scrippets.
- Per-scrippet overlap protection while an invocation is still running.
- A bounded, session-local recent execution log with duration and failure details.
- Settings UI to pick the folder, reload, inspect load errors, and add new templates.

## Security

Scrippets execute with the same privileges as Obsidian. They can read, write, or delete any file in your vault and interact with the DOM. Only install scripts you trust, review the source, and enable **Run startup scripts at launch** only when you accept that approved code runs automatically on every load. Untrusted startup scrippets require a separate one-time approval; trusting their folder bypasses that prompt.

## Scrippet structure

Scrippets live in `/<vault>/<folder>/*.js`. By default, the folder is `<vault config dir>/scrippets/` (usually `.obsidian/scrippets/`). Startup scrippets go into the `startup/` sub-folder.

Each file must expose an `invoke(plugin)` or `invoke(plugin, settings)` function. Three export shapes are supported:

```js
/* @name: Daily Notice @id: daily-notice */
class Scrippet {
  async invoke(plugin) {
    new Notice("Remember to review your daily note!");
  }
}
```

```js
/* @name: Exported Notice @id: exported-notice */
module.exports = class ExportedNotice {
  async invoke(plugin) {
    new Notice(`Running inside ${plugin.manifest.name}.`);
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

An optional block comment at the top of the file can provide directives:

- `@name` – display name in settings and the command palette
- `@id` – stable identifier; otherwise derived from the filename
- `@desc` – short description shown in settings
- `@requires-snippet` – CSS snippet id that must exist in `<vault config dir>/snippets/` before the scrippet can run; use the snippet filename with or without the `.css` extension
- `@settings` – JSON or YAML mapping describing configurable parameters

A required snippet only needs to exist. Its enabled/disabled state remains under the scrippet's control, which allows commands such as Toggle Wrap to enable and disable their own snippet. Missing dependencies fail through the normal execution error path and are included in recent execution history.

The same metadata can also be supplied through YAML frontmatter. Scrippets masks YAML frontmatter before evaluating the JavaScript while preserving its line layout for useful stack traces. For `.js` files that should remain valid JavaScript for linters, formatters, and editors, prefer block-comment metadata.

### Configurable parameters

Structured parameters can be declared with `@settings` inside the metadata comment. Keeping the schema inside a comment means the file remains valid JavaScript. Parameter values are stored by scrippet ID and passed as the second argument to `invoke`.

```js
/*
@name: Example
@id: parameter-example
@settings: {
  "enabled": {
    "type": "boolean",
    "label": "Enabled",
    "default": true
  },
  "margin": {
    "type": "number",
    "label": "Margin",
    "description": "Space around the feature.",
    "default": 32,
    "min": 0,
    "max": 100,
    "step": 1,
    "unit": "px"
  },
  "message": {
    "type": "string",
    "label": "Message",
    "default": "Hello"
  },
  "mode": {
    "type": "select",
    "label": "Mode",
    "options": {
      "compact": "Compact",
      "comfortable": "Comfortable"
    },
    "default": "comfortable"
  }
}
*/
class Scrippet {
  async invoke(plugin, settings) {
    new Notice(`${settings.message} — ${settings.mode}`);
  }
}
```

Supported parameter types are `boolean`, `number`, `string`, and `select`. Number parameters may define `min`, `max`, `step`, and `unit`. Select options may be a mapping as above or a list of strings / `{ value, label }` mappings. Saved values that no longer match the schema fall back to the declared default.

Structured `settings` metadata is also accepted through YAML frontmatter for compatibility, but comment metadata is recommended when the scrippet should remain standalone-valid JavaScript.

The settings panel shows a **Scrippet parameters** section for every loaded scrippet that declares parameters. A **Reset** button removes saved overrides and returns that scrippet to its defaults.

### Configuring CSS snippets with parameters

A parameter can optionally bind to a CSS custom property with `css-var`. For safety, bound custom-property names must start with `--scrippets-`. Scrippets keeps the property in sync with the saved parameter value and restores the previous inline value when the plugin unloads or the binding disappears.

For example, an `@settings` mapping can include:

```json
{
  "fade-width": {
    "type": "number",
    "label": "Edge fade width",
    "default": 32,
    "min": 0,
    "max": 100,
    "unit": "px",
    "css-var": "--scrippets-nowrap-fade-width"
  }
}
```

The dependent CSS snippet can then use a fallback normally:

```css
.cm-editor::after {
  width: var(--scrippets-nowrap-fade-width, 32px);
}
```

For CSS-bound number parameters, `unit` is appended to the custom-property value. Boolean values are exposed as `1` or `0`; string and select values are passed through as text. When more than one loaded scrippet binds the same CSS variable, the scrippet with the later ID in lexical order wins. The `--scrippets-` prefix is required, and names such as `--scrippets-<id>-...` are recommended to avoid collisions.

See `examples/toggle_nowrap.js` and `examples/nowrap.css` for a complete scrippet + snippet pair that exposes cursor margin, edge fade width, and scrollbar clearance through the settings panel.

### Startup scripts

Files inside `<folder>/startup/` can run automatically when Obsidian loads. Enable **Run startup scripts at launch** in the settings tab to opt in. Before an untrusted startup scrippet runs automatically for the first time, Scrippets asks for a separate one-time approval. This approval is independent of normal first-run history, so running the same scrippet manually does not approve unattended startup execution. Trusted folders bypass the per-file startup prompt. Each startup script can also be disabled individually. Errors are surfaced with `Notice` notifications so one failure does not prevent other scripts from running.

## Settings highlights

Open **Settings → Community plugins → Scrippets** to:

- Change the scrippet folder.
- Toggle startup execution, confirm-first-run, and review safety warnings.
- Inspect loaded commands, enable/disable them, and run them manually.
- Configure parameters declared by scrippets and reset saved overrides.
- View load errors or skipped files (e.g., duplicate IDs).
- Add new files via the **+** dialog, including templates for the supported export shapes.
- See whether a scrippet is currently running.
- Review the ten most recent entries from the current session's execution history.

Reload, folder-change, rename-remediation, and file-event reconciliation are serialized so overlapping scans cannot publish state concurrently.

## Installation

1. `npm install`
2. `npm run build`
3. Copy `main.js`, `manifest.json`, and `styles.css` into `<Vault>/.obsidian/plugins/scrippets/`.
4. Enable **Scrippets** in **Settings → Community plugins**.

## Development

```bash
npm install
npm run dev    # watch mode
npm run check  # type-check + lint + tests
npm run build  # type-check + bundle
```

The project uses TypeScript 5, esbuild, ESLint, and Node's test runner via `tsx`. Source files live in `src/` and bundle to `main.js`.

## Versioning

- Plugin version lives in `manifest.json` and `package.json`.
- Minimum supported Obsidian version is declared in `manifest.json` and mapped in `versions.json`.
- Use `npm run release` scripts or `npm version` to bump consistently.

See [CHANGELOG.md](./CHANGELOG.md) for a human-readable history of updates.

## Release process

1. Confirm the working tree is clean and the GitHub CLI (`gh`) is authenticated (`gh auth login`).
2. Run `npm run release -- --type=patch` (default) or `--type=minor` / `--type=major` depending on the bump you need.
   - To specify an exact version instead, use `npm run release -- --version=1.2.3`.
3. The release script will build the bundle, run `npm version`, push the branch and tags, and create the GitHub release using the notes from `CHANGELOG.md`.
   - Add `--no-push` to skip pushing, or `--no-publish` to skip the GitHub release step.

## Project structure

```
obsidian-scrippets/
├── src/                # TypeScript sources
│   ├── main.ts         # Plugin entry
│   ├── scrippet-manager.ts
│   ├── metadata.ts
│   ├── parameters.ts
│   └── ui/             # Settings UI and modals
├── examples/
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
