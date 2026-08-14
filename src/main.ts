import { Notice, Plugin, normalizePath } from "obsidian";
import { ScrippetParameterCssRegistry } from "./parameter-css";
import { ScrippetManager } from "./scrippet-manager";
import { DEFAULT_SETTINGS, type ScrippetPluginSettings } from "./types";
import { ScrippetSettingTab } from "./ui/settings-tab";

export default class ScrippetPlugin extends Plugin {
  settings: ScrippetPluginSettings = DEFAULT_SETTINGS;
  manager!: ScrippetManager;
  readonly parameterCss = new ScrippetParameterCssRegistry();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.manager = new ScrippetManager(this);
    this.addSettingTab(new ScrippetSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      void this.initializeManager();
    });
  }

  onunload(): void {
    this.parameterCss.clear();
    this.manager?.destroy();
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<ScrippetPluginSettings> | null;
    const defaultFolder = normalizePath(`${this.app.vault.configDir}/scrippets`);
    this.settings = {
      ...DEFAULT_SETTINGS,
      folder: defaultFolder,
      ...(data ?? {}),
      scrippetSettings: data?.scrippetSettings ?? {},
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async initializeManager(): Promise<void> {
    try {
      await this.manager.initialize();
      if (this.settings.runStartupOnLoad) {
        await this.manager.runStartupScripts();
      }
    } catch (error) {
      console.error("Scrippets: failed to initialize", error);
      new Notice(`Scrippets failed to initialize: ${(error as Error).message ?? String(error)}`);
    }
  }
}
