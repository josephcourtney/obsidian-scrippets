import { App, Modal, Setting } from "obsidian";

export function confirmFirstRun(app: App, scriptName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = new ConfirmRunModal(app, scriptName, resolve);
    modal.open();
  });
}

class ConfirmRunModal extends Modal {
  private readonly scriptName: string;
  private readonly resolver: (value: boolean) => void;
  private resolved = false;

  constructor(app: App, scriptName: string, resolver: (value: boolean) => void) {
    super(app);
    this.scriptName = scriptName;
    this.resolver = resolver;
  }

  onOpen(): void {
    this.modalEl.addClass("scrippet-confirm-modal");
    this.titleEl.setText("Run scrippet?");
    this.contentEl.createEl("p", {
      text: `This is the first time running "${this.scriptName}". Only continue if you trust this code.`,
    });
    this.contentEl.createEl("p", {
      text: "Scrippets can read and modify anything in your vault and run with the same permissions as Obsidian.",
      cls: "scrippet-confirm-warning",
    });

    const buttons = new Setting(this.contentEl);
    buttons.addButton((btn) =>
      btn
        .setButtonText("Cancel")
        .setWarning()
        .onClick(() => {
          this.resolve(false);
        }),
    );
    buttons.addButton((btn) =>
      btn
        .setButtonText("Run")
        .setCta()
        .onClick(() => {
          this.resolve(true);
        }),
    );
  }

  onClose(): void {
    if (!this.resolved) {
      this.resolver(false);
    }
    this.contentEl.empty();
  }

  private resolve(result: boolean): void {
    if (this.resolved) return;
    this.resolved = true;
    this.close();
    this.resolver(result);
  }
}
