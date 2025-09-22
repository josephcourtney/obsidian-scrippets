/* @name: Toggle Wrap @id: toggle-wrap @desc: Toggle the "nowrap" CSS snippet */
class ToggleLineWrap {
  async invoke(plugin) {
    const { customCss } = plugin.app;
    const snippetId = "nowrap";
    const enabled = customCss.enabledSnippets.has(snippetId);
    customCss.setCssEnabledStatus(snippetId, !enabled);
    new Notice(`${snippetId} ${enabled ? "disabled" : "enabled"}.`);
  }
}

module.exports = ToggleLineWrap;
