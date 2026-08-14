# Changelog

All notable changes to this project will be documented in this file. Dates use the ISO 8601 format (YYYY-MM-DD).

## [Unreleased]
### Added
- Add `@requires-snippet` metadata so scrippets can declare CSS snippet file dependencies that are checked before invocation.
- Add typed per-scrippet parameters declared through YAML frontmatter, persisted by scrippet ID, rendered in the settings panel, and passed to `invoke(plugin, settings)`.
- Add optional `css-var` bindings so parameter values can configure dependent CSS snippets through custom properties.

### Changed
- Extend the nowrap example with configurable cursor margin, fade width, and scrollbar clearance plus a matching CSS snippet example.

### Fixed
- Mask YAML frontmatter before JavaScript evaluation so frontmatter-based scrippets remain executable while preserving source line layout.

## [1.5.0] - 2026-08-03
### Added
- Add bounded, session-local execution history with trigger, duration, status, and error details.
- Show running state in settings and prevent overlapping invocation of the same scrippet.
- Add regression tests for serialized task execution and recovery after failed queued work.

### Changed
- Serialize full reloads, folder changes, duplicate-id remediation, and file-event reconciliation so scans cannot overlap.
- Label settings-triggered runs separately from command-palette and startup runs in execution history.
- Reuse the normal execution path for startup scrippets after startup approval, keeping error and running-state behavior consistent.

### Fixed
- Prevent concurrent reload/reconciliation operations from racing while mutating descriptor and command state.

## [1.4.1] - 2026-08-03
### Fixed
- Require a one-time per-scrippet approval before an untrusted startup scrippet can run automatically.
- Keep startup approval separate from normal first-run history so a previously run command is not implicitly approved for unattended startup.

### Changed
- Clarify startup, trusted-folder, and first-run confirmation messaging around the new approval behavior.
- Correct contributor documentation to reflect the automated regression test suite included in `npm run check`.


## [1.4.0] - 2026-08-03
### Added
- Add regression tests for supported runtime export shapes and include tests in `npm run check`.
- Add a root MIT `LICENSE` file for Community Plugins submission readiness.

### Changed
- Rename the unreleased plugin id from `obsidian-scrippets` to `scrippets`.
- Resolve the default scrippet folder from Obsidian's configured vault config directory instead of hardcoding `.obsidian`.
- Defer manager initialization and startup-script execution until the workspace layout is ready.
- Make folder changes explicit with an Apply button and prevent folder changes from executing startup scripts.
- Restrict configurable script extensions to `.js` and `.cjs`; `.mjs` files were never evaluated as real ES modules.
- Make full-scan duplicate-id selection deterministic by processing normalized paths in sorted order.

### Fixed
- Fix runtime export resolution so empty `module.exports` no longer masks `Scrippet`, `defaultExport`, or bare `invoke` forms.
- Fix generated class templates so they use the supported `Scrippet` convention.
- Re-scan after duplicate-id remediation and when conflicts change so valid scripts recover without requiring a manual reload.
- Cancel pending reload timers when the plugin unloads.

## [1.3.0] - 2025-09-24
### Added
- Document metadata-first scanning with header previews and accessible first-run modals introduced after 1.1.1.
- Add realtime search, multi-criteria sorting, duplicate-id remediation, and hotkey shortcuts to the settings list.
- Support configurable `.js`, `.mjs`, and `.cjs` extensions plus YAML front-matter metadata with comment fallbacks.
- Provide quick actions for copying the scrippet folder path and trusting folders with revoke controls.

### Changed
- Batch vault events with adaptive debounce and reuse cached file reads per scan cycle while limiting source maps to development builds.
- Add `npm run check`, Prettier formatting, and upgraded ESLint v9 TypeScript rules (including `no-floating-promises`).

## [1.1.1] - 2025-09-23
### Added
- Add metadata-first scanning with header previews, first-run context, and accessible modals.
- Add settings controls to open scrippet files and copy their vault-relative paths.

### Changed
- Migrate script state tracking to stable scrippet ids with incremental reloads and lazy loading.
- Append source URLs to evaluated scripts for clearer stack traces and runtime notices.

## [1.1.0] - 2025-09-22
### Added
- Vault-based scrippet manager with metadata parsing, hot reload, and per-script enablement.
- Settings tab with folder selection, startup opt-in, command toggles, manual run, and creation dialog.
- Confirmation modals for first-run execution and startup enablement warnings.
- Styles for warning blocks and modals, plus comprehensive example scripts for every supported export shape.

### Changed
- Plugin now bundles TypeScript sources from `src/` with TypeScript 5, esbuild, and bundler module resolution.
- Startup scripts run only when explicitly enabled; failures surface via notices without halting other scripts.
- Plugin is now mobile-compatible by replacing Node `fs` usage with the vault adapter.

### Removed
- Desktop-only restriction caused by FileSystemAdapter-dependent file access.

## [1.0.1] - 2023-??-??
### Fixed
- Minor adjustments and bug fixes following the initial release.

## [1.0.0] - 2023-??-??
### Added
- Initial release with basic command loading and startup script execution.

[1.4.0]: https://github.com/josephcourtney/obsidian-scrippets/releases/tag/1.4.0
[1.1.1]: https://github.com/josephcourtney/obsidian-scrippets/releases/tag/1.1.1
[1.1.0]: https://github.com/josephcourtney/obsidian-scrippets/releases/tag/1.1.0
[1.0.1]: https://github.com/josephcourtney/obsidian-scrippets/releases/tag/1.0.1
[1.0.0]: https://github.com/josephcourtney/obsidian-scrippets/releases/tag/1.0.0

