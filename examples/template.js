/* @name: Example Template @id: example-template @desc: Reference implementation */
module.exports = class ExampleTemplate {
  async invoke(plugin) {
    try {
      // Access the Obsidian API through the plugin instance.
      await plugin.app.workspace.onLayoutReady(() => {
        new Notice("Example template executed.");
      });
    } catch (error) {
      console.error("Example template failed", error);
      new Notice(
        "Example template failed: " + (error instanceof Error ? error.message : String(error)),
      );
    }
  }
};
