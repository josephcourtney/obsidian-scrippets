import { Plugin } from "obsidian";
import { ScrippetManager } from "./scrippet-manager";
import { DEFAULT_SETTINGS, type ScrippetPluginSettings } from "./types";
import { ScrippetSettingTab } from "./ui/settings-tab";

export default class ScrippetPlugin extends Plugin {
  settings: ScrippetPluginSettings = DEFAULT_SETTINGS;
  manager!: ScrippetManager;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.manager = new ScrippetManager(this);
    await this.manager.initialize();
    this.addSettingTab(new ScrippetSettingTab(this.app, this));
  }

  onunload(): void {
    // Manager registers commands and events via plugin helper methods; Obsidian handles cleanup.
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) ?? {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
