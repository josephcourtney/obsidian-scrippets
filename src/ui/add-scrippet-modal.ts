import { App, Modal, Notice, Setting, TextComponent, normalizePath } from "obsidian";
import type ScrippetPlugin from "../main";
import { slugify } from "../metadata";

interface TemplateOption {
  id: string;
  label: string;
  description: string;
  build: (context: TemplateContext) => string;
}

interface TemplateContext {
  name: string;
  id: string;
  description?: string;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: "class",
    label: "Class declaration",
    description: "Defines a class with invoke(plugin).",
    build: ({ name, id, description }) => {
      const header = renderHeader(name, id, description);
      return (
        header +
        `class ${pascalCase(id)} {
  async invoke(plugin) {
    try {
      const { app } = plugin;
      new Notice("${name} ran successfully.");
    } catch (error) {
      console.error("${name} failed", error);
      new Notice("${name} failed: " + (error instanceof Error ? error.message : error));
    }
  }
}
`
      );
    },
  },
  {
    id: "module",
    label: "module.exports",
    description: "Exports a class via module.exports.",
    build: ({ name, id, description }) => {
      const header = renderHeader(name, id, description);
      return (
        header +
        `module.exports = class ${pascalCase(id)} {
  async invoke(plugin) {
    try {
      const { app } = plugin;
      new Notice("${name} executed.");
    } catch (error) {
      console.error("${name} failure", error);
      new Notice("${name} failed: " + (error instanceof Error ? error.message : error));
    }
  }
};
`
      );
    },
  },
  {
    id: "object",
    label: "invoke object",
    description: "Returns an object with an invoke function.",
    build: ({ name, id, description }) => {
      const header = renderHeader(name, id, description);
      return (
        header +
        `const invoke = async (plugin) => {
  try {
    const { app } = plugin;
    new Notice("${name} invoked.");
  } catch (error) {
    console.error("${name} failed", error);
    new Notice("${name} failed: " + (error instanceof Error ? error.message : error));
  }
};

module.exports = { invoke };
`
      );
    },
  },
];

export class AddScrippetModal extends Modal {
  private readonly plugin: ScrippetPlugin;
  private name = "New scrippet";
  private identifier = "new-scrippet";
  private description = "";
  private template = TEMPLATES[0];
  private startup = false;
  private idManuallyEdited = false;
  private idInput?: TextComponent;

  constructor(app: App, plugin: ScrippetPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.titleEl.setText("Add scrippet");
    const form = this.contentEl.createDiv("scrippet-add-form");

    new Setting(form)
      .setName("Scrippet name")
      .setDesc("Used for display and metadata.")
      .addText((text) =>
        text
          .setValue(this.name)
          .onChange((value) => {
            this.name = value.trim() || "New scrippet";
            const slug = slugify(this.name);
            if (!this.idManuallyEdited) {
              this.identifier = slug || "new-scrippet";
              this.idInput?.setValue(this.identifier);
            }
          }),
      );

    new Setting(form)
      .setName("Command ID")
      .setDesc("Used for command palette IDs and must be unique.")
      .addText((text) => {
        this.idInput = text;
        text
          .setValue(this.identifier)
          .onChange((value) => {
            const nameSlug = slugify(this.name) || "new-scrippet";
            const sanitized = slugify(value) || nameSlug;
            this.identifier = sanitized;
            this.idManuallyEdited = sanitized !== nameSlug;
            if (sanitized !== value) {
              text.setValue(sanitized);
            }
          });
      });

    new Setting(form)
      .setName("Description")
      .setDesc("Optional short explanation shown in settings.")
      .addText((text) =>
        text
          .setValue(this.description)
          .onChange((value) => {
            this.description = value.trim();
          }),
      );

    new Setting(form)
      .setName("Template")
      .setDesc("Choose how the scrippet exports invoke().")
      .addDropdown((dropdown) => {
        TEMPLATES.forEach((template) => {
          dropdown.addOption(template.id, template.label);
        });
        dropdown.setValue(this.template.id);
        dropdown.onChange((value) => {
          const picked = TEMPLATES.find((template) => template.id === value);
          if (picked) this.template = picked;
        });
      });

    new Setting(form)
      .setName("Create in startup folder")
      .setDesc("Startup scrippets run automatically when enabled.")
      .addToggle((toggle) =>
        toggle.setValue(this.startup).onChange((value) => {
          this.startup = value;
        }),
      );

    const footer = new Setting(form);
    footer.addButton((btn) =>
      btn.setButtonText("Cancel").onClick(() => {
        this.close();
      }),
    );
    footer.addButton((btn) =>
      btn
        .setButtonText("Create")
        .setCta()
        .onClick(async () => {
          await this.create();
        }),
    );
  }

  async create(): Promise<void> {
    const id = slugify(this.identifier);
    if (!id) {
      new Notice("Enter a valid command ID.");
      return;
    }
    const name = this.name.trim() || "New scrippet";
    const context: TemplateContext = {
      name,
      id,
      description: this.description || undefined,
    };
    const content = this.template.build(context).trim() + "\n";

    const folder = this.startup
      ? normalizePath(`${this.plugin.settings.folder}/startup`)
      : normalizePath(this.plugin.settings.folder);
    const filePath = normalizePath(`${folder}/${id}.js`);

    const adapter = this.plugin.app.vault.adapter;
    if (await adapter.exists(filePath)) {
      new Notice(`"${filePath}" already exists.`);
      return;
    }

    try {
      await this.plugin.app.vault.create(filePath, content);
      new Notice(`Created ${filePath}`);
      await this.plugin.manager.reload();
      this.close();
    } catch (error) {
      console.error("Scrippets: failed to create scrippet", error);
      new Notice(`Failed to create ${filePath}: ${(error as Error).message ?? error}`);
    }
  }
}

function renderHeader(name: string, id: string, description?: string): string {
  const parts = [`@name: ${name}`, `@id: ${id}`];
  if (description) parts.push(`@desc: ${description}`);
  return `/* ${parts.join(" ")} */\n\n`;
}

function pascalCase(value: string): string {
  return value
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("") || "Scrippet";
}
