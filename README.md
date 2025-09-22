# Obsidian Scrippets

An Obsidian plugin for creating and loading custom JavaScript “scrippets” directly from your vault.
Each scrippet can define a command or execute code on startup, enabling personalized automation and extensions.

## Features

- Loads user-authored JavaScript classes from `<vault>/.obsidian/scrippets/*.js`.
- Each `.js` file should export a class with an `invoke()` method.
- Plugin registers each class as a command named after the file.
- Executes startup scripts automatically from `<vault>/.obsidian/scrippets/startup/*.js`.
- Provides an empty settings tab (reserved for future options).
- Desktop-only (uses filesystem access).

## Example Scrippet

`<vault>/.obsidian/scrippets/hello.js`:

```js
class Hello {
  invoke() {
    new Notice("Hello from scrippet!");
  }
}
```

This creates a command **Scrippet: hello** in the Obsidian command palette.

## Installation

### Option 1: Install via BRAT (Beta Reviewer's Auto-update Tool)

1. Install and enable the [Obsidian42 - BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin from the community plugins browser.
2. In BRAT settings, choose **Add Beta plugin**.
3. Enter this repository's URL:
   `
   https://github.com/josephcourtney/obsidian-scrippets
   `
4. BRAT will clone the repository and keep it updated automatically.

### Option 2: Manual installation
1. Build the plugin:

   ```bash
   npm ci
   npm run build
   ```
2. Copy the following files into your vault:

   ```
   <vault>/.obsidian/plugins/obsidian-scrippets/
     ├── main.js
     ├── manifest.json
     ├── styles.css
   ```
3. Enable **Scrippets** in **Settings → Community plugins**.

## Development

* **Install dependencies**:

  ```bash
  npm install
  ```
* **Start development mode** (watch + rebuild on changes):

  ```bash
  npm run dev
  ```
* **Build for release**:

  ```bash
  npm run build
  ```

The build pipeline uses **TypeScript** and **esbuild**.
Linting is configured via ESLint.

## Versioning

* Version is tracked in `manifest.json`.
* Minimum Obsidian version compatibility is tracked in `versions.json`.
* Use `npm version` to bump and update both files consistently.

## Limitations

* Requires desktop Obsidian (uses `FileSystemAdapter`).
* No built-in security: all scripts are executed as-is.
  Only run code you trust.

## Project Structure

```
obsidian-scrippets/
├── main.ts / main.js          # Plugin entry (compiled)
├── manifest.json / versions.json
├── styles.css
├── esbuild.config.mjs / tsconfig.json
├── package.json / package-lock.json
└── AGENTS.md                  # Development guidelines
```

## References

* [Obsidian API docs](https://docs.obsidian.md)
* [Sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
