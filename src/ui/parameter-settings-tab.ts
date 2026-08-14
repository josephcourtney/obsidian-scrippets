import { App, Notice, Setting } from "obsidian";
import type ScrippetPlugin from "../main";
import {
  coerceScrippetParameterValue,
  resolveScrippetParameterCssVarName,
  resolveScrippetParameterValues,
  shouldUseScrippetParameterSlider,
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
      .setDesc(
        "Tune values declared by each scrippet. Changes are saved by scrippet ID and passed to invoke(plugin, settings).",
      )
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
        button
          .setButtonText("Reset all")
          .setTooltip("Reset all parameters to their defaults")
          .onClick(async () => {
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
    this.renderParameterDetails(setting, descriptor, key, definition);

    if (definition.type === "boolean") {
      setting.addToggle((toggle) =>
        toggle.setValue(Boolean(value)).onChange(async (next) => {
          await this.saveParameterValue(descriptor, key, definition, next);
        }),
      );
    } else if (definition.type === "select") {
      setting.addDropdown((dropdown) => {
        for (const option of definition.options ?? []) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown.setValue(String(value)).onChange(async (next) => {
          await this.saveParameterValue(descriptor, key, definition, next);
        });
      });
    } else if (definition.type === "number") {
      this.renderNumberControl(setting, descriptor, key, definition, Number(value));
    } else {
      this.renderTextControl(setting, descriptor, key, definition, String(value));
    }

    setting.addExtraButton((button) =>
      button
        .setIcon("rotate-ccw")
        .setTooltip(`Reset to default (${this.formatParameterValue(definition, definition.default)})`)
        .onClick(async () => {
          await this.resetParameterValue(descriptor, key);
        }),
    );
  }

  private renderNumberControl(
    setting: Setting,
    descriptor: ScrippetDescriptor,
    key: string,
    definition: ScrippetParameterDefinition,
    value: number,
  ): void {
    let setSliderValue: ((next: number) => void) | undefined;
    let numberInput: HTMLInputElement | undefined;

    if (shouldUseScrippetParameterSlider(definition)) {
      const min = definition.min ?? 0;
      const max = definition.max ?? 100;
      const step = definition.step ?? 1;
      setting.addSlider((slider) => {
        slider.setLimits(min, max, step).setValue(value).setInstant(true);
        setSliderValue = (next) => slider.setValue(next);
        slider.onChange(async (next) => {
          if (numberInput) numberInput.value = String(next);
          await this.saveParameterValue(descriptor, key, definition, next);
        });
      });
    }

    setting.addText((text) => {
      numberInput = text.inputEl;
      text.inputEl.addClass("scrippet-parameter-number-input");
      text.setValue(String(value));
      text.inputEl.type = "number";
      if (definition.min != null) text.inputEl.min = String(definition.min);
      if (definition.max != null) text.inputEl.max = String(definition.max);
      if (definition.step != null) text.inputEl.step = String(definition.step);
      text.onChange(async (next) => {
        if (next.trim() === "") return;
        try {
          const coerced = coerceScrippetParameterValue(definition, next);
          const numeric = Number(coerced);
          setSliderValue?.(numeric);
          text.setValue(String(numeric));
          await this.saveParameterValue(descriptor, key, definition, numeric);
          text.inputEl.removeClass("scrippet-parameter-invalid");
        } catch (error) {
          text.inputEl.addClass("scrippet-parameter-invalid");
          console.debug(`Scrippets: invalid parameter ${descriptor.id}.${key}`, error);
        }
      });
    });

    if (definition.unit) {
      setting.controlEl.createSpan({ cls: "scrippet-parameter-unit", text: definition.unit });
    }
  }

  private renderTextControl(
    setting: Setting,
    descriptor: ScrippetDescriptor,
    key: string,
    definition: ScrippetParameterDefinition,
    value: string,
  ): void {
    setting.addText((text) => {
      text.setValue(value).onChange(async (next) => {
        try {
          await this.saveParameterValue(descriptor, key, definition, next);
          text.inputEl.removeClass("scrippet-parameter-invalid");
        } catch (error) {
          text.inputEl.addClass("scrippet-parameter-invalid");
          console.debug(`Scrippets: invalid parameter ${descriptor.id}.${key}`, error);
        }
      });
    });
  }

  private renderParameterDetails(
    setting: Setting,
    descriptor: ScrippetDescriptor,
    key: string,
    definition: ScrippetParameterDefinition,
  ): void {
    const details = setting.descEl.createDiv({ cls: "scrippet-parameter-details" });
    details.createSpan({
      cls: "scrippet-parameter-default",
      text: `Default: ${this.formatParameterValue(definition, definition.default)}`,
    });

    const cssVar = resolveScrippetParameterCssVarName(descriptor.id, key, definition);
    if (cssVar) {
      const cssDetail = details.createSpan({ cls: "scrippet-parameter-css-var" });
      cssDetail.createSpan({ text: "CSS: " });
      cssDetail.createEl("code", { text: cssVar });
    }
  }

  private formatParameterValue(
    definition: ScrippetParameterDefinition,
    value: ScrippetParameterValue,
  ): string {
    if (definition.type === "number") return `${value}${definition.unit ?? ""}`;
    if (definition.type === "boolean") return value ? "On" : "Off";
    return String(value);
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
      this.syncParameterCss();
      await this.scrippetPlugin.saveSettings();
    } catch (error) {
      console.error("Scrippets: failed to save parameter value", error);
      new Notice("Failed to save scrippet parameter.");
      throw error;
    }
  }

  private async resetParameterValue(descriptor: ScrippetDescriptor, key: string): Promise<void> {
    const current = this.scrippetPlugin.settings.scrippetSettings[descriptor.id];
    if (!current || !Object.prototype.hasOwnProperty.call(current, key)) return;

    const next = { ...current };
    delete next[key];
    if (Object.keys(next).length === 0) {
      delete this.scrippetPlugin.settings.scrippetSettings[descriptor.id];
    } else {
      this.scrippetPlugin.settings.scrippetSettings[descriptor.id] = next;
    }

    await this.scrippetPlugin.saveSettings();
    this.syncParameterCss();
    this.redisplayPreservingScroll();
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
