# Changelog

All notable changes to this project will be documented in this file. Dates use the ISO 8601 format (YYYY-MM-DD).

## [Unreleased]
### Added
- Document metadata-first scanning with header previews and accessible first-run modals introduced after 1.1.1.
- Add realtime search, multi-criteria sorting, duplicate-id remediation, and hotkey shortcuts to the settings list.
- Support configurable `.js`, `.mjs`, and `.cjs` extensions plus YAML front-matter metadata with comment fallbacks.
- Provide quick actions for copying the scrippet folder path and trusting folders with revoke controls.

### Changed
- Batch vault events with adaptive debounce and reuse cached file reads per scan cycle while limiting source maps to development builds.
- Add `npm run check`, Prettier formatting, and upgraded ESLint v9 TypeScript rules (including `no-floating-promises`).

## [1.1.1] - 2025-03-05
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

[1.1.1]: https://github.com/josephcourtney/obsidian-scrippets/releases/tag/1.1.1
[1.1.0]: https://github.com/josephcourtney/obsidian-scrippets/releases/tag/1.1.0
[1.0.1]: https://github.com/josephcourtney/obsidian-scrippets/releases/tag/1.0.1
[1.0.0]: https://github.com/josephcourtney/obsidian-scrippets/releases/tag/1.0.0
