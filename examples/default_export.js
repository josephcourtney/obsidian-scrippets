/* @name: Focus Active Leaf @id: focus-leaf */
const defaultExport = class FocusActiveLeaf {
  async invoke(plugin) {
    const leaf = plugin.app.workspace.getMostRecentLeaf();
    if (!leaf) {
      new Notice("No leaf to focus.");
      return;
    }
    plugin.app.workspace.setActiveLeaf(leaf, { focus: true });
  }
};
