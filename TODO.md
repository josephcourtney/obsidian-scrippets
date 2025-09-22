- [ ] Replace sync FS with vault APIs to remove desktop-only constraint.
  - Use `await this.app.vault.adapter.list('.obsidian/scrippets')` and `read` for files.
  - Drop `getBasePath()` and Node `fs/path` at runtime.
* [ ] Avoid blocking `onload`
  - Switch to async directory reads and `Promise.all` for file loads.
* [ ] Fix class loading contract.
  - `eval('(' + src + ')')` requires a class *expression*. Accept three shapes and normalize:
  ```ts
  // returns {invoke(plugin: Plugin): void}
  function loadScrippet(src: string) {
    const f = new Function('plugin','app','Notice',
      `${src}; return (typeof module!=='undefined'&&module.exports)
        || (typeof exports!=='undefined'&&exports)
        || (typeof Scrippet!=='undefined'&&Scrippet)
        || (typeof defaultExport!=='undefined'&&defaultExport)
        || (typeof invoke==='function'&&{invoke})
        || (typeof window.Scrippet==='function'&&window.Scrippet)
        ;`);
    const mod = f(this, this.app, Notice);
    const inst = typeof mod === 'function' ? new mod() : mod;
    if (!inst?.invoke) throw new Error('Scrippet must expose invoke()');
    return inst as {invoke: (plugin: Plugin)=>void};
  }
  ```
* [ ] Pass context instead of relying on globals.
  - Call `inst.invoke(this)` and document signature.
* [ ] Contain execution scope.
  - Prefer `new Function` over `window.eval`.
  - Provide a minimal API object and avoid leaking full `window`.
* [ ] Add settings UI.
  - Choose scrippets folder.
  - Toggle startup folder execution.
  - Show loaded scripts, reload button, and per-script enable/disable.
  - Add a "+" button that adds an "add scrippet" dialog
    - Optional confirm-before-first-run.
* [ ] Harden startup execution.
  - Try/catch per file with surfaced errors via `new Notice`.
  - Skip failures without aborting the rest.
* [ ] Names and IDs.
  - Allow optional header comment for metadata:
  - `/* @name: Toggle Wrap @id: toggle-wrap @desc: … */`.
  - Use `id` if present, else filename.
  - Validate uniqueness.
* [ ] Hot reload.
  - Watch `.obsidian/scrippets/**` with `app.vault.on('modify'|'create'|'delete', …)` to rebuild command registry.
* [ ] Security documentation.
  - Add explicit warning and opt-in switch for “Run startup scripts”.
* [ ] Packaging/metadata.
  - Pin `obsidian` types to a version.
  - Remove `eslint-js` GitHub dep.
  - Upgrade TS to 5.x and set `"moduleResolution": "Bundler"`.
  - Consider raising `minAppVersion` to a tested value.
* [ ] Tests and examples.
  - Include example that demonstrates each accepted export shape.
  - Provide a template scrippet showing `invoke(plugin)` and error handling.
