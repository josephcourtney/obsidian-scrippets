/*
@name: Toggle Wrap
@id: toggle-wrap
@desc: Toggle editor line wrapping
@requires-snippet: nowrap
@settings: {
  "cursor-margin": {
    "type": "number",
    "label": "Cursor scroll margin",
    "description": "Start horizontal scrolling before the caret reaches the right edge.",
    "default": 48,
    "min": 0,
    "max": 200,
    "step": 1,
    "unit": "px",
    "control": "slider"
  }
}
*/
class ToggleLineWrap {
  async invoke(plugin, settings) {
    const app = plugin.app;
    const { customCss } = app;
    const snippetId = "nowrap";
    const enabled = customCss.enabledSnippets.has(snippetId);
    const nextEnabled = !enabled;

    const key = "__toggleWrapEditorExtensions";
    if (!plugin[key]) {
      plugin[key] = [];
      plugin.registerEditorExtension(plugin[key]);
    }

    const extensions = plugin[key];
    extensions.length = 0;

    if (nextEnabled) {
      const cm = app.workspace.activeLeaf?.view?.editor?.cm;
      const EditorView = cm?.constructor;
      const cursorMargin = settings?.["cursor-margin"] ?? 48;

      if (EditorView?.cursorScrollMargin) {
        extensions.push(
          EditorView.cursorScrollMargin.of({
            x: cursorMargin,
            y: 5,
          }),
        );
      }
    }

    customCss.setCssEnabledStatus(snippetId, nextEnabled);
    app.workspace.updateOptions();

    new Notice(`${snippetId} ${nextEnabled ? "enabled" : "disabled"}.`);
  }
}

module.exports = ToggleLineWrap;
