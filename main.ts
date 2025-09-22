import * as fs from "fs";
import * as path from "path";
import { App, Plugin, PluginSettingTab } from "obsidian";

type ScrippetCtor = new () => { invoke: () => void };

interface ScrippetPluginSettings {}

const DEFAULT_SETTINGS: ScrippetPluginSettings = {};

export default class ScrippetPlugin extends Plugin {
  settings!: ScrippetPluginSettings;
  scrippets!: Record<string, { invoke: () => void }>;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.scrippets = {};

    // Resolve `<vault>/.obsidian/scrippets`
    const adapter = this.app.vault.adapter;
    // Desktop-only: requires FileSystemAdapter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vaultDirectory = (adapter as any).getBasePath?.();
    if (!vaultDirectory) {
      console.warn(
        "Scrippets: FileSystemAdapter not available. Plugin requires desktop.",
      );
      return;
    }
    const scrippetDirectory = path.join(
      vaultDirectory,
      this.app.vault.configDir,
      "scrippets",
    );

    // Execute startup scripts from "<scrippets>/startup/*.js"
    try {
      fs.readdirSync(path.join(scrippetDirectory, "startup"))
        .filter((file: string) => path.extname(file) === ".js")
        .forEach((file: string) => {
          const src = fs.readFileSync(
            path.join(scrippetDirectory, "startup", file),
            "utf-8",
          );
          console.log("Scrippets: executing startup scrippet:", file);
          // Deliberate eval: user-authored scripts
          // eslint-disable-next-line no-eval
          (window as unknown as { eval: (code: string) => unknown }).eval(src);
        });
    } catch (e) {
      // No startup directory or read error
      console.debug("Scrippets: no startup scripts or failed to read.", e);
    }

    // Load command scrippets from "<scrippets>/*.js"
    try {
      fs.readdirSync(scrippetDirectory)
        .filter((file: string) => path.extname(file) === ".js")
        .forEach((file: string) => {
          const src = fs.readFileSync(
            path.join(scrippetDirectory, file),
            "utf-8",
          );
          // Wrap to get exported class as value
          // eslint-disable-next-line no-eval
          const ScrippetClass = (
            window as unknown as { eval: (code: string) => unknown }
          ).eval(`(${src})`) as ScrippetCtor;
          const name = path.basename(file, ".js");

          this.scrippets[name] = new ScrippetClass();

          this.addCommand({
            id: `scrippet-${name}`,
            name,
            callback: () => {
              try {
                this.scrippets[name].invoke();
              } catch (err) {
                console.error(`Scrippets: error invoking "${name}"`, err);
              }
            },
          });

          console.log(`Scrippets: loaded command "${name}"`);
        });
    } catch (e) {
      console.warn("Scrippets: failed to load scrippets directory.", e);
    }

    this.addSettingTab(new ScrippetSettingTab(this.app, this));
  }

  onunload(): void {}

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

export class ScrippetSettingTab extends PluginSettingTab {
  plugin: ScrippetPlugin;

  constructor(app: App, plugin: ScrippetPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    // Intentionally empty. Add settings here when needed.
  }
}
