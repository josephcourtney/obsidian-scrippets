import { App, Notice, Setting } from "obsidian";
import type ScrippetPlugin from "../main";
import {
  coerceScrippetParameterValue,
  resolveScrippetParameterValues,
} from "../parameters";
import type {
  ScrippetDescriptor,
  ScrippetParameterDefinition,
  ScrippetParameterValue,
} from "../types";
import { ScrippetSettingTab } from "./settings-tab";

export class ParameterizedScrippetSettingTab extends ScrippetSettingTab {
  private readonly scrippetPlugin: ScrippetPlugin;

  constructor(app: App, plugin: ScrippetPlugin) {
    super(app, plugin);
    this.scrippetPlugin = plugin;
    this.scrippetPlugin.manager.subscribe(() => {
      this.syncParameterCss();
    });
  }

  override display(): void {
    super.display();
    this.syncParameterCss();
    this.renderParameterSection();
  }

  private renderParameterSection(): void {
    const descriptors = this.getParameterizedDescriptors();
    if (descriptors.length === 0) return;

    new Setting(this.containerEl)
      .setName("Scrippet parameters")
      .setDesc("Values are stored by scrippet ID and passed to invoke(plugin, settings).")
      .setHeading();

    const section = this.containerEl.createDiv({ cls: "scrippet-parameter-section" });
    for (const descriptor of descriptors) {
      this.renderScrippetParameters(section, descriptor);
    }
  }

  private renderScrippetParameters(container: HTMLElement, descriptor: ScrippetDescriptor): void {
    const schema = descriptor.metadata.settings;
    if (!schema) return;

    const card = container.createDiv({ cls: "scrippet-parameter-card" });
    const header = new Setting(card).setName(descriptor.name);
    const requiredSnippet = descriptor.metadata["requires-snippet"];
    header.setDesc(
      requiredSnippet
        ? `ID: ${descriptor.id} · CSS snippet: ${requiredSnippet}`
        : `ID: ${descriptor.id}`,
    );

    if (this.hasSavedValues(descriptor.id)) {
      header.addButton((button) =>
        button.setButtonText("Reset").setTooltip("Reset parameters to defaults").onClick(async () => {
          delete this.scrippetPlugin.settings.scrippetSettings[descriptor.id];
          await this.scrippetPlugin.saveSettings();
          this.syncParameterCss();
          this.redisplayPreservingScroll();
        }),
      );
    }

    const values = resolveScrippetParameterValues(
      schema,
      this.scrippetPlugin.settings.scrippetSettings[descriptor.id],
    );

    for (const [key, definition] of Object.entries(schema)) {
      this.renderParameterControl(card, descriptor, key, definition, values[key] ?? definition.default);
    }
  }

  private renderParameterControl(
    container: HTMLElement,
    descriptor: ScrippetDescriptor,
    key: string,
    definition: ScrippetParameterDefinition,
    value: ScrippetParameterValue,
  ): void {
    const setting = new Setting(container).setName(definition.label);
    if (definition.description) setting.setDesc(definition.description);

    if (definition.type === "boolean") {
      setting.addToggle((toggle) =>
        toggle.setValue(Boolean(value)).onChange(async (next) => {
          await this.saveParameterValue(descriptor, key, definition, next);
        }),
      );
      return;
    }

    if (definition.type === "select") {
      setting.addDropdown((dropdown) => {
        for (const option of definition.options ?? []) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown.setValue(String(value)).onChange(async (next) => {
          await this.saveParameterValue(descriptor, key, definition, next);
        });
      });
      return;
    }

    setting.addText((text) => {
      text.setValue(String(value));
      if (definition.type === "number") {
        text.inputEl.type = "number";
        if (definition.min != null) text.inputEl.min = String(definition.min);
        if (definition.max != null) text.inputEl.max = String(definition.max);
        if (definition.step != null) text.inputEl.step = String(definition.step);
      }
      text.onChange(async (next) => {
        if (definition.type === "number" && next.trim() === "") return;
        try {
          await this.saveParameterValue(descriptor, key, definition, next);
          text.inputEl.removeClass("scrippet-parameter-invalid");
        } catch (error) {
          text.inputEl.addClass("scrippet-parameter-invalid");
          console.debug(`Scrippets: invalid parameter ${descriptor.id}.${key}`, error);
        }
      });
    });

    if (definition.type === "number" && definition.unit) {
      setting.controlEl.createSpan({ cls: "scrippet-parameter-unit", text: definition.unit });
    }
  }

  private async saveParameterValue(
    descriptor: ScrippetDescriptor,
    key: string,
    definition: ScrippetParameterDefinition,
    raw: unknown,
  ): Promise<void> {
    const value = coerceScrippetParameterValue(definition, raw);
    const current = this.scrippetPlugin.settings.scrippetSettings[descriptor.id] ?? {};
    this.scrippetPlugin.settings.scrippetSettings[descriptor.id] = {
      ...current,
      [key]: value,
    };

    try {
      await this.scrippetPlugin.saveSettings();
      this.syncParameterCss();
    } catch (error) {
      console.error("Scrippets: failed to save parameter value", error);
      new Notice("Failed to save scrippet parameter.");
      throw error;
    }
  }

  private getParameterizedDescriptors(): ScrippetDescriptor[] {
    const { commands, startup } = this.scrippetPlugin.manager.scan;
    return [...commands, ...startup]
      .filter((descriptor) => Boolean(descriptor.metadata.settings))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private hasSavedValues(id: string): boolean {
    return Object.keys(this.scrippetPlugin.settings.scrippetSettings[id] ?? {}).length > 0;
  }

  private syncParameterCss(): void {
    const { commands, startup } = this.scrippetPlugin.manager.scan;
    this.scrippetPlugin.parameterCss.sync(
      [...commands, ...startup],
      this.scrippetPlugin.settings.scrippetSettings,
    );
  }

  private redisplayPreservingScroll(): void {
    const scrollTop = this.containerEl.scrollTop;
    this.display();
    this.containerEl.scrollTop = scrollTop;
  }
}
