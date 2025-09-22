/* @name: Clipboard Timestamp @id: clipboard-timestamp @desc: Copies a timestamp to the clipboard */
const invoke = async (plugin) => {
  const stamp = new Date().toISOString();
  await navigator.clipboard.writeText(stamp);
  new Notice(`Copied ${stamp}`);
};

module.exports = { invoke };
