# AGENTS.md

## Project

Scrippets is an Obsidian community plugin that discovers JavaScript files in a vault and exposes them as commands or opt-in startup scripts.

The plugin is written in TypeScript and bundled with esbuild. `src/main.ts` is the plugin entry point; the generated bundle is `main.js`.

## Commands

Use the repository's npm scripts rather than invoking underlying tools directly.

```bash
npm install
npm run dev
npm run check
npm run build
npm run format
```

* `npm run dev` — watch and rebuild during development.
* `npm run check` — TypeScript validation plus ESLint.
* `npm run build` — type-check and produce the production `main.js` bundle.
* `npm run format` — format source, styles, and Markdown.

Before finishing a source-code change, run `npm run check`.

Also run `npm run build` when the change can affect runtime behavior, bundling, dependencies, release output, or build configuration.

There is currently no automated test suite. For behavior that cannot be validated through static checks or a production build, state the relevant manual verification steps.

## Source Layout

* `src/main.ts` — plugin lifecycle and top-level wiring.
* `src/scrippet-manager.ts` — discovery, state, command registration, reload handling, and execution orchestration.
* `src/scrippet-loader.ts` — JavaScript evaluation and supported export-shape normalization.
* `src/metadata.ts` — metadata parsing and updating for YAML frontmatter and comment directives.
* `src/types.ts` — shared domain types, settings types, and defaults.
* `src/ui/` — settings UI and modals.
* `examples/` — example scrippets and supported export shapes.
* `styles.css` — plugin UI styles.
* `scripts/release.mjs` — release automation.

Keep responsibilities within these boundaries unless a refactor has a clear reason to change them.

## Project Invariants

### Vault access

Use Obsidian vault APIs for vault content.

* Prefer `app.vault`, `app.vault.adapter`, `TFile`, and related Obsidian APIs.
* Do not use Node `fs` for vault files.
* Normalize vault-relative paths with `normalizePath`.
* Preserve mobile compatibility unless a change explicitly requires a desktop-only API.

Node APIs are acceptable for repository tooling such as build and release scripts outside the plugin runtime.

### Plugin lifecycle

* Avoid unnecessary blocking work in `Plugin.onload()`.
* Use asynchronous vault I/O.
* Register Obsidian events, DOM events, intervals, and similar resources through plugin lifecycle helpers where available so cleanup occurs on unload.
* Keep `src/main.ts` focused on lifecycle and top-level wiring rather than domain logic.

### Scrippet discovery

Scrippet discovery and reload behavior must remain deterministic.

* Preserve stable IDs where possible.
* Detect duplicate IDs rather than silently choosing one.
* Keep file-event handling debounced or batched to avoid redundant scans.
* Do not introduce random or timing-dependent execution ordering without an explicit product requirement.
* Startup execution must remain opt-in.

### Metadata

Scrippets may obtain metadata from YAML frontmatter and supported header comment directives.

Important metadata includes:

* `id`
* `name`
* `description` / `desc`

When changing metadata behavior:

* preserve compatibility with existing comment-based metadata;
* preserve YAML frontmatter support;
* keep ID derivation deterministic;
* avoid destroying unrelated metadata when updating a known field.

Check `src/metadata.ts` for the authoritative implementation before changing parsing behavior.

### Script formats

The plugin supports configurable JavaScript-family extensions, including `.js`, `.mjs`, and `.cjs`.

Do not assume all scrippets use one export syntax. Inspect `src/scrippet-loader.ts` and `examples/` when changing module loading or execution behavior.

## Security

Scrippets execute user-supplied JavaScript with access to the plugin and Obsidian application environment.

The evaluator is **not a security sandbox**.

Changes must not imply that arbitrary scrippet code is isolated or safe.

* Preserve prominent warnings around arbitrary-code execution.
* Do not weaken first-run or startup-script safety UX without an explicit requirement.
* Do not add telemetry, analytics, or network communication without explicit opt-in and documentation.
* Do not silently execute previously untrusted startup scripts.
* Surface execution and loading failures to the user where actionable, while retaining useful console diagnostics for debugging.

Treat trusted-folder and first-run behavior as security-sensitive code.

## Error Handling

Do not silently discard failures that affect user-visible behavior.

For scrippet loading or execution failures:

* provide an actionable `Notice` where appropriate;
* log enough context to diagnose the failing scrippet;
* allow unrelated scrippets to continue when one fails.

Avoid broad catch blocks that hide programming errors without either reporting or deliberately handling them.

## Dependencies

Prefer existing dependencies and Obsidian APIs over adding packages.

Avoid new runtime dependencies unless they provide clear value that cannot reasonably be implemented with the existing stack.

When adding a dependency:

* explain why it is necessary in the change summary;
* prefer a development dependency when it is only needed for tooling;
* consider bundle size and mobile compatibility;
* update the lockfile together with `package.json`.

## Generated Files

`main.js` is generated by esbuild.

* Do not edit `main.js` manually.
* Do not commit generated build output unless repository policy explicitly changes.
* Do not commit `node_modules/`.

Tracked release-related files include:

* `manifest.json`
* `versions.json`
* `styles.css`
* `CHANGELOG.md`

GitHub release assets are:

* `main.js`
* `manifest.json`
* `styles.css`, when present

## Manifest and Versioning

Do not change `manifest.json.id` after release.

Keep release versions consistent across:

* `manifest.json`
* `package.json`
* `versions.json`

Keep `minAppVersion` aligned with the minimum Obsidian API version actually supported by the plugin.


For version or release work, inspect these files before editing:

* `manifest.json`
* `package.json`
* `versions.json`
* `CHANGELOG.md`
* `scripts/version-bump.mjs`
* `scripts/release.mjs`

Do not perform version bumps as part of ordinary feature or bug-fix work unless the task explicitly includes a release.

## Changelog

Maintain `CHANGELOG.md` using the existing Keep a Changelog structure.

Use the standard section names where applicable:

* `Added`
* `Changed`
* `Deprecated`
* `Removed`
* `Fixed`
* `Security`

Document user-visible changes and significant developer-facing changes.

Do not rewrite released historical entries except to correct factual errors, broken references, or similar mistakes.

Match the existing changelog style rather than inventing additional formatting rules.

## Releases

Use the repository release automation instead of manually reproducing the release sequence.

```bash
npm run release -- --type=patch
npm run release -- --type=minor
npm run release -- --type=major
npm run release -- --version=x.y.z
```

Supported workflow flags include:

```bash
--no-push
--no-publish
```

The release process builds the plugin, bumps versions, creates the Git tag, optionally pushes, and optionally creates the GitHub release.

When modifying release behavior, treat `scripts/release.mjs` as the authoritative implementation and update documentation to match it.

## Style and Code Quality

Follow the existing TypeScript and formatting configuration.

* Keep TypeScript types explicit where they improve correctness.
* Avoid unnecessary type assertions.
* Do not suppress ESLint rules unless the underlying operation genuinely requires it and the reason is local and clear.
* Handle promises deliberately; the project enforces `@typescript-eslint/no-floating-promises`.
* Prefer small, focused functions over expanding already-large orchestration methods.
* Preserve existing public behavior unless the task requires a breaking change.

Use Prettier for formatting instead of manually enforcing formatting conventions.

## UI Changes

For changes under `src/ui/`:

* follow Obsidian UI conventions and existing component patterns;
* preserve keyboard accessibility and usable focus behavior;
* keep warnings and confirmation flows understandable;
* avoid introducing desktop-only assumptions;
* scope CSS so plugin styles do not affect unrelated Obsidian UI.

## Before Finishing

For code changes:

1. Review the diff for unintended generated-file or version changes.
2. Run `npm run check`.
3. Run `npm run build` when runtime or build output may be affected.
4. Verify that security warnings and startup opt-in behavior remain intact when relevant.
5. Update documentation or `CHANGELOG.md` when the change materially affects users or established project behavior.
6. Report any validation that could not be performed.

Do not claim a check, build, or manual verification passed unless it was actually run.


## References

- [Obsidian API docs](https://docs.obsidian.md)
- [Obsidian sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Developer policies](https://docs.obsidian.md/Developer+policies)
- [Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [Style guide](https://help.obsidian.md/style-guide)
