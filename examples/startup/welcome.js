/* @name: Welcome Notice @id: welcome-notice @desc: Shows a notice after startup */
module.exports = {
  async invoke(plugin) {
    new Notice(`Welcome back to ${plugin.app.workspace.getName?.() ?? "your vault"}!`);
  },
};
