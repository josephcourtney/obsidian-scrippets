import { App, Notice, PluginSettingTab, Setting, TFile, normalizePath, setIcon } from "obsidian";
import type ScrippetPlugin from "../main";
import type { ScrippetDescriptor, ScrippetDuplicate, ScrippetSortField } from "../types";
import { AddScrippetModal } from "./add-scrippet-modal";
import { StartupWarningModal } from "./startup-warning-modal";

const SORT_LABELS: Record<ScrippetSortField, string> = {
  name: "Name",
  modified: "Last modified",
  enabled: "Enabled",
};

const EXTENSION_OPTIONS = [".js", ".mjs", ".cjs"] as const;

export class ScrippetSettingTab extends PluginSettingTab {
  private readonly plugin: ScrippetPlugin;
  private filterQuery = "";
  private listContainer: HTMLElement | null = null;

  constructor(app: App, plugin: ScrippetPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.plugin.manager.subscribe(() => {
      if (this.containerEl.isConnected) this.display();
    });
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.renderHeader(containerEl);
    this.renderSecurityNotice(containerEl);
    this.renderFolderSetting(containerEl);
    this.renderTrustControls(containerEl);
    this.renderExtensionControls(containerEl);
    this.renderStartupToggle(containerEl);
    this.renderConfirmToggle(containerEl);
    this.renderManageControls(containerEl);
    this.renderMessages(containerEl);
    this.renderListControls(containerEl);

    this.listContainer = containerEl.createDiv({ cls: "scrippet-list-sections" });
    this.renderResults();
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "scrippet-header" });
    header.createEl("h2", { text: "Scrippets" });

    const actions = header.createDiv({ cls: "scrippet-header-actions" });
    const copyButton = actions.createEl("button", { cls: "scrippet-icon-button", type: "button" });
    copyButton.setAttr("aria-label", "Copy scrippets folder path");
    setIcon(copyButton, "copy");
    copyButton.addEventListener("click", () => {
      void this.copyFolderPath();
    });
  }

  private renderSecurityNotice(container: HTMLElement): void {
    const warning = container.createEl("div", { cls: "scrippet-warning" });
    warning.createEl("strong", { text: "Security notice" });
    warning.createEl("p", {
      text: "Scrippets can run arbitrary JavaScript with full access to your vault. Only run code you trust.",
    });
  }

  private renderFolderSetting(container: HTMLElement): void {
    new Setting(container)
      .setName("Scrippets folder")
      .setDesc("Relative path inside your vault where scrippets are stored.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            await this.plugin.manager.setFolder(value);
            text.setValue(this.plugin.settings.folder);
            this.display();
          }),
      );
  }

  private renderTrustControls(container: HTMLElement): void {
    const currentFolder = normalizePath(this.plugin.settings.folder);
    const trusted = this.isFolderTrusted(currentFolder);

    new Setting(container)
      .setName("Always trust this folder")
      .setDesc("Skip first-run confirmations for scripts in this folder.")
      .addToggle((toggle) =>
        toggle.setValue(trusted).onChange(async (value) => {
          await this.setFolderTrust(currentFolder, value);
        }),
      );

    this.renderTrustedFolderList(container, currentFolder);
  }

  private renderTrustedFolderList(container: HTMLElement, currentFolder: string): void {
    const others = this.plugin.settings.trustedFolders
      .map((folder) => normalizePath(folder))
      .filter((folder) => folder !== currentFolder);
    if (others.length === 0) return;

    const wrapper = container.createDiv({ cls: "scrippet-trusted-folders" });
    wrapper.createEl("h4", { text: "Trusted folders" });
    for (const folder of others) {
      const setting = new Setting(wrapper)
        .setName(folder)
        .setDesc("Scripts in this folder skip first-run confirmation.");
      setting.addButton((btn) =>
        btn
          .setButtonText("Revoke trust")
          .setTooltip("Remove this folder from the trusted list")
          .onClick(async () => {
            await this.setFolderTrust(folder, false);
            this.display();
          }),
      );
    }
  }

  private renderExtensionControls(container: HTMLElement): void {
    const setting = new Setting(container)
      .setName("Allowed file extensions")
      .setDesc("Choose which file types to scan for scrippets.");

    const options = setting.controlEl.createDiv({ cls: "scrippet-extension-options" });
    for (const ext of EXTENSION_OPTIONS) {
      const option = options.createEl("label", { cls: "scrippet-extension-option" });
      const input = option.createEl("input", { type: "checkbox" });
      input.checked = this.hasExtension(ext);
      input.addEventListener("change", () => {
        this.handleExtensionToggle(ext, input);
      });
      option.createSpan({ text: ext });
    }
  }

  private renderStartupToggle(container: HTMLElement): void {
    new Setting(container)
      .setName("Run startup scripts at launch")
      .setDesc(
        "Runs files inside the startup folder when Obsidian loads. Leave disabled unless you understand the risks.",
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.runStartupOnLoad);
        toggle.onChange(async (value) => {
          if (value && !this.plugin.settings.startupAcknowledged) {
            const confirmed = await new StartupWarningModal(this.app).openAndWait();
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
  }

  private renderConfirmToggle(container: HTMLElement): void {
    new Setting(container)
      .setName("Confirm before first run")
      .setDesc("Ask for confirmation the first time each scrippet executes.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.confirmBeforeFirstRun).onChange(async (value) => {
          this.plugin.settings.confirmBeforeFirstRun = value;
          await this.plugin.saveSettings();
        }),
      );
  }

  private renderManageControls(container: HTMLElement): void {
    const manage = new Setting(container)
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
  }

  private renderMessages(container: HTMLElement): void {
    const { errors, duplicates } = this.plugin.manager.scan;
    if (errors.length > 0) {
      const errorBox = container.createEl("div", { cls: "scrippet-error" });
      errorBox.createEl("strong", { text: "Failed to load" });
      const list = errorBox.createEl("ul");
      for (const error of errors) {
        list.createEl("li", { text: `${error.path}: ${error.message}` });
      }
    }

    if (duplicates.length > 0) {
      const duplicateBox = container.createEl("div", { cls: "scrippet-warning scrippet-duplicates" });
      duplicateBox.createEl("strong", { text: "Duplicate IDs" });
      for (const duplicate of duplicates) {
        this.renderDuplicate(duplicateBox, duplicate);
      }
    }
  }

  private renderDuplicate(container: HTMLElement, duplicate: ScrippetDuplicate): void {
    const setting = new Setting(container)
      .setName(duplicate.path)
      .setDesc(`Conflicting id "${duplicate.id}". Suggested id: ${duplicate.suggestion}.`);
    setting.addButton((btn) =>
      btn
        .setButtonText(`Rename to ${duplicate.suggestion}`)
        .onClick(async () => {
          await this.handleDuplicateRename(duplicate);
        }),
    );
    setting.addExtraButton((btn) =>
      btn
        .setIcon("file")
        .setTooltip("Open file")
        .onClick(() => {
          void this.openFile(duplicate.path);
        }),
    );
  }

  private renderListControls(container: HTMLElement): void {
    const controls = container.createDiv({ cls: "scrippet-controls" });

    const searchWrapper = controls.createDiv({ cls: "scrippet-search" });
    const searchInput = searchWrapper.createEl("input", {
      type: "search",
      placeholder: "Filter scrippets",
      value: this.filterQuery,
    });
    searchInput.addEventListener("input", () => {
      this.filterQuery = searchInput.value;
      this.renderResults();
    });

    const sortWrapper = controls.createDiv({ cls: "scrippet-sort" });
    const sortLabel = sortWrapper.createEl("label", { text: "Sort by", cls: "scrippet-sort-label" });
    sortLabel.setAttr("for", "scrippet-sort-select");

    const select = sortWrapper.createEl("select", { attr: { id: "scrippet-sort-select" } });
    for (const field of Object.keys(SORT_LABELS) as ScrippetSortField[]) {
      const option = select.createEl("option", { text: SORT_LABELS[field] });
      option.value = field;
    }
    select.value = this.plugin.settings.listSort.field;
    select.addEventListener("change", () => {
      void this.updateSortField(select.value as ScrippetSortField);
    });

    const directionButton = sortWrapper.createEl("button", {
      cls: "scrippet-icon-button",
      type: "button",
    });
    const applyDirectionIcon = (direction: "asc" | "desc") => {
      setIcon(directionButton, direction === "asc" ? "arrow-up" : "arrow-down");
      directionButton.setAttr(
        "aria-label",
        `Toggle sort direction (${direction === "asc" ? "ascending" : "descending"})`,
      );
    };
    applyDirectionIcon(this.plugin.settings.listSort.direction);
    directionButton.addEventListener("click", () => {
      void (async () => {
        const direction = await this.toggleSortDirection();
        applyDirectionIcon(direction);
      })();
    });
  }

  private renderResults(): void {
    if (!this.listContainer) return;
    this.listContainer.empty();
    const { commands, startup } = this.plugin.manager.scan;
    this.renderListSection(this.listContainer, "Command scrippets", commands, false);
    this.renderListSection(this.listContainer, "Startup scrippets", startup, true);
  }

  private renderListSection(
    container: HTMLElement,
    heading: string,
    descriptors: ScrippetDescriptor[],
    startup: boolean,
  ): void {
    container.createEl("h3", { text: heading });
    const section = container.createDiv({ cls: "scrippet-list" });
    const items = this.prepareDescriptors(descriptors);
    if (items.length === 0) {
      section.createEl("p", {
        text: startup ? "No startup scripts found." : "No command scripts found.",
      });
      return;
    }

    for (const script of items) {
      this.renderDescriptor(section, script, startup);
    }
  }

  private renderDescriptor(container: HTMLElement, script: ScrippetDescriptor, startup: boolean): void {
    const setting = new Setting(container)
      .setName(script.name)
      .setDesc(this.buildDescription(script));

    setting.addToggle((toggle) =>
      toggle.setValue(script.enabled).onChange(async (value) => {
        await this.plugin.manager.toggleDescriptor(script, value);
      }),
    );

    setting.addExtraButton((btn) =>
      btn
        .setIcon("copy")
        .setTooltip("Copy path")
        .onClick(() => {
          void this.copyToClipboard(normalizePath(script.path), "Scrippet path copied.", "Failed to copy path.");
        }),
    );

    setting.addExtraButton((btn) =>
      btn
        .setIcon("file")
        .setTooltip("Open file")
        .onClick(() => {
          void this.openFile(script.path);
        }),
    );

    if (!startup) {
      setting.addExtraButton((btn) =>
        btn
          .setIcon("key")
          .setTooltip("Assign hotkey")
          .onClick(() => {
            this.openHotkeySettings(script);
          }),
      );

      setting.addExtraButton((btn) =>
        btn
          .setIcon("play")
          .setTooltip("Run now")
          .setDisabled(!script.enabled)
          .onClick(async () => {
            if (!script.enabled) return;
            await this.plugin.manager.executeById(script.id);
          }),
      );
    }
  }

  private prepareDescriptors(descriptors: ScrippetDescriptor[]): ScrippetDescriptor[] {
    return this.sortDescriptors(descriptors.filter((descriptor) => this.matchesFilter(descriptor)));
  }

  private sortDescriptors(descriptors: ScrippetDescriptor[]): ScrippetDescriptor[] {
    const { field, direction } = this.plugin.settings.listSort;
    const factor = direction === "asc" ? 1 : -1;
    const sorted = [...descriptors];
    sorted.sort((a, b) => {
      if (field === "name") return factor * a.name.localeCompare(b.name);
      if (field === "modified") {
        const diff = a.modified - b.modified;
        if (diff !== 0) return factor * diff;
        return a.name.localeCompare(b.name);
      }
      if (field === "enabled") {
        const diff = (Number(a.enabled) - Number(b.enabled)) * factor;
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }

  private matchesFilter(descriptor: ScrippetDescriptor): boolean {
    const query = this.filterQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      descriptor.name.toLowerCase().includes(query) ||
      descriptor.id.toLowerCase().includes(query) ||
      normalizePath(descriptor.path).toLowerCase().includes(query) ||
      (descriptor.description?.toLowerCase().includes(query) ?? false)
    );
  }

  private buildDescription(script: ScrippetDescriptor): string {
    const parts = [] as string[];
    if (script.description) parts.push(script.description);
    parts.push(`ID: ${script.id}`);
    parts.push(`File: ${normalizePath(script.path)}`);
    parts.push(`Modified: ${this.formatModified(script.modified)}`);
    return parts.join(" \u2014 ");
  }

  private formatModified(modified: number): string {
    const date = new Date(modified);
    if (Number.isNaN(date.getTime())) return "unknown";
    return date.toLocaleString();
  }

  private async copyFolderPath(): Promise<void> {
    const folder = normalizePath(this.plugin.settings.folder);
    await this.copyToClipboard(folder, "Scrippets folder path copied.", "Failed to copy folder path.");
  }

  private async copyToClipboard(text: string, success: string, failure: string): Promise<void> {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(text);
      new Notice(success);
    } catch (error) {
      console.error("Scrippets: clipboard write failed", error);
      new Notice(failure);
    }
  }

  private async openFile(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      new Notice("Scrippet file not found.");
      return;
    }
    await this.app.workspace.getLeaf(true).openFile(file);
  }

  private openHotkeySettings(script: ScrippetDescriptor): void {
    const commandId = this.plugin.manager.getCommandId(script.id);
    const settingManager = (this.app as App & {
      setting: {
        openTabById: (id: string) => void;
        activeTab: unknown;
        containerEl: HTMLElement;
      };
    }).setting;
    settingManager.openTabById("hotkeys");
    window.setTimeout(() => {
      const active = settingManager.activeTab as { setQuery?: (query: string) => void; containerEl: HTMLElement } | null;
      if (active?.setQuery) {
        active.setQuery(commandId);
        return;
      }
      const input = settingManager.containerEl.querySelector<HTMLInputElement>("input[type=\"search\"]");
      if (input) {
        input.focus();
        input.value = commandId;
        input.dispatchEvent(new Event("input"));
      }
    }, 50);
  }

  private async handleDuplicateRename(duplicate: ScrippetDuplicate): Promise<void> {
    try {
      await this.plugin.manager.renameScrippetId(duplicate.path, duplicate.id, duplicate.suggestion);
      new Notice(`Updated id to ${duplicate.suggestion}.`);
    } catch (error) {
      console.error("Scrippets: failed to rename duplicate id", error);
      new Notice((error as Error).message ?? "Failed to rename scrippet id.");
    }
  }

  private async updateSortField(field: ScrippetSortField): Promise<void> {
    if (this.plugin.settings.listSort.field === field) return;
    this.plugin.settings.listSort.field = field;
    await this.plugin.saveSettings();
    this.renderResults();
  }

  private async toggleSortDirection(): Promise<"asc" | "desc"> {
    const next = this.plugin.settings.listSort.direction === "asc" ? "desc" : "asc";
    this.plugin.settings.listSort.direction = next;
    await this.plugin.saveSettings();
    this.renderResults();
    return next;
  }

  private hasExtension(ext: string): boolean {
    const normalized = ext.toLowerCase();
    return this.plugin.settings.allowedExtensions.some((entry) => entry.toLowerCase() === normalized);
  }

  private handleExtensionToggle(ext: string, input: HTMLInputElement): void {
    const enabled = input.checked;
    if (!enabled && this.plugin.settings.allowedExtensions.length <= 1 && this.hasExtension(ext)) {
      input.checked = true;
      new Notice("At least one extension must remain enabled.");
      return;
    }
    void this.setExtensionEnabled(ext, enabled);
  }

  private async setExtensionEnabled(ext: string, enabled: boolean): Promise<void> {
    const normalized = ext.toLowerCase();
    const set = new Set(this.plugin.settings.allowedExtensions.map((entry) => entry.toLowerCase()));
    if (enabled) set.add(normalized);
    else set.delete(normalized);
    this.plugin.settings.allowedExtensions = Array.from(set).sort();
    await this.plugin.saveSettings();
    await this.plugin.manager.reload();
  }

  private isFolderTrusted(folder: string): boolean {
    const normalized = normalizePath(folder);
    return this.plugin.settings.trustedFolders.some((entry) => normalizePath(entry) === normalized);
  }

  private async setFolderTrust(folder: string, trusted: boolean): Promise<void> {
    const normalized = normalizePath(folder);
    const entries = new Set(this.plugin.settings.trustedFolders.map((entry) => normalizePath(entry)));
    if (trusted) entries.add(normalized);
    else entries.delete(normalized);
    this.plugin.settings.trustedFolders = Array.from(entries).sort();
    await this.plugin.saveSettings();
  }
}
