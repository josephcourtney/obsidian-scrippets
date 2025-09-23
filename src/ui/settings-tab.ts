import { App, Notice, PluginSettingTab, Setting, TFile, normalizePath } from "obsidian";
import type ScrippetPlugin from "../main";
import type { ScrippetDescriptor } from "../types";
import { AddScrippetModal } from "./add-scrippet-modal";
import { StartupWarningModal } from "./startup-warning-modal";

export class ScrippetSettingTab extends PluginSettingTab {
  private readonly plugin: ScrippetPlugin;
  constructor(app: App, plugin: ScrippetPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.plugin.manager.subscribe(() => {
      if (this.containerEl.isConnected) this.display();
    });
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Scrippets" });

    const warning = containerEl.createEl("div", { cls: "scrippet-warning" });
    warning.createEl("strong", { text: "Security notice" });
    warning.createEl("p", {
      text: "Scrippets can run arbitrary JavaScript with full access to your vault. Only run code you trust.",
    });

    new Setting(containerEl)
      .setName("Scrippets folder")
      .setDesc("Relative path inside your vault where scrippets are stored.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            await this.plugin.manager.setFolder(value);
            text.setValue(this.plugin.settings.folder);
          }),
      );

    new Setting(containerEl)
      .setName("Run startup scripts at launch")
      .setDesc(
        "Runs files inside the startup folder when Obsidian loads. Leave disabled unless you understand the risks.",
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.runStartupOnLoad);
        toggle.onChange(async (value) => {
          if (value && !this.plugin.settings.startupAcknowledged) {
            const confirmed = await new StartupWarningModal(
              this.app,
            ).openAndWait();
            if (!confirmed) {
              toggle.setValue(false);
              return;
            }
            this.plugin.settings.startupAcknowledged = true;
          }
          this.plugin.settings.runStartupOnLoad = value;
          await this.plugin.saveSettings();
          if (value) await this.plugin.manager.runStartupScripts();
        });
      });

    new Setting(containerEl)
      .setName("Confirm before first run")
      .setDesc("Ask for confirmation the first time each scrippet executes.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.confirmBeforeFirstRun).onChange(async (value) => {
          this.plugin.settings.confirmBeforeFirstRun = value;
          await this.plugin.saveSettings();
        }),
      );

    const manage = new Setting(containerEl)
      .setName("Manage scrippets")
      .setDesc("Reload after editing files or add new ones.");
    manage.addButton((btn) =>
      btn.setButtonText("Reload").onClick(async () => {
        await this.plugin.manager.reload();
        new Notice("Scrippets reloaded.");
      }),
    );
    manage.addExtraButton((btn) =>
      btn
        .setIcon("plus")
        .setTooltip("Add scrippet")
        .onClick(() => {
          new AddScrippetModal(this.app, this.plugin).open();
        }),
    );

    const { commands, startup, errors, skipped } = this.plugin.manager.scan;

    if (errors.length > 0) {
      const errorBox = containerEl.createEl("div", { cls: "scrippet-error" });
      errorBox.createEl("strong", { text: "Failed to load" });
      const list = errorBox.createEl("ul");
      for (const error of errors) {
        list.createEl("li", { text: `${error.path}: ${error.message}` });
      }
    }

    if (skipped.length > 0) {
      const skippedBox = containerEl.createEl("div", { cls: "scrippet-warning" });
      skippedBox.createEl("strong", { text: "Skipped" });
      const list = skippedBox.createEl("ul");
      for (const path of skipped) {
        list.createEl("li", { text: `${path} (duplicate id)` });
      }
    }

    renderList(containerEl, "Command scrippets", commands, this.plugin);
    renderList(containerEl, "Startup scrippets", startup, this.plugin, true);
  }
}

function renderList(
  container: HTMLElement,
  heading: string,
  scripts: ScrippetDescriptor[],
  plugin: ScrippetPlugin,
  startup = false,
): void {
  container.createEl("h3", { text: heading });
  const section = container.createDiv({ cls: "scrippet-list" });
  if (scripts.length === 0) {
    section.createEl("p", { text: startup ? "No startup scripts found." : "No command scripts found." });
    return;
  }

  for (const script of scripts) {
    const setting = new Setting(section)
      .setName(script.name)
      .setDesc(buildDescription(script));

    setting.addToggle((toggle) =>
      toggle.setValue(script.enabled).onChange(async (value) => {
        await plugin.manager.toggleDescriptor(script, value);
      }),
    );

    setting.addExtraButton((btn) =>
      btn
        .setIcon("copy")
        .setTooltip("Copy path")
        .onClick(async () => {
          const path = normalizePath(script.path);
          try {
            await navigator.clipboard.writeText(path);
            new Notice("Scrippet path copied.");
          } catch (error) {
            console.error("Scrippets: unable to copy path", error);
            new Notice("Failed to copy path.");
          }
        }),
    );

    setting.addExtraButton((btn) =>
      btn
        .setIcon("file")
        .setTooltip("Open file")
        .onClick(async () => {
          const file = plugin.app.vault.getAbstractFileByPath(script.path);
          if (!(file instanceof TFile)) {
            new Notice("Scrippet file not found.");
            return;
          }
          await plugin.app.workspace.getLeaf(true).openFile(file);
        }),
    );

    if (!startup) {
      setting.addExtraButton((btn) =>
        btn
          .setIcon("play")
          .setTooltip("Run now")
          .setDisabled(!script.enabled)
          .onClick(async () => {
            if (!script.enabled) return;
            await plugin.manager.executeById(script.id);
          }),
      );
    }
  }
}

function buildDescription(script: ScrippetDescriptor): string {
  const parts = [] as string[];
  if (script.description) parts.push(script.description);
  parts.push(`ID: ${script.id}`);
  parts.push(`File: ${normalizePath(script.path)}`);
  return parts.join(" \u2014 ");
}
