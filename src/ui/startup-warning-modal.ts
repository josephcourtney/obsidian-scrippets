import { App, Modal, Setting } from "obsidian";
import { applyModalAccessibility } from "./accessibility";

export class StartupWarningModal extends Modal {
  private resolver!: (result: boolean) => void;
  private resolved = false;
  private cleanupAccessibility: (() => void) | null = null;

  constructor(app: App) {
    super(app);
  }

  openAndWait(): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.open();
    });
  }

  onOpen(): void {
    this.titleEl.setText("Enable startup scripts?");
    this.contentEl.createEl("p", {
      text: "Startup scrippets run automatically every time Obsidian loads. Only enable if you trust every script in the startup folder.",
    });
    this.contentEl.createEl("p", {
      text: "They can modify or delete any file in your vault and run without additional confirmation.",
      cls: "scrippet-confirm-warning",
    });
    const buttons = new Setting(this.contentEl);
    let cancelEl: HTMLElement | undefined;
    buttons.addButton((btn) => {
      cancelEl = btn.buttonEl;
      btn
        .setButtonText("Cancel")
        .setWarning()
        .onClick(() => this.resolve(false));
    });
    buttons.addButton((btn) =>
      btn
        .setButtonText("Enable")
        .setCta()
        .onClick(() => this.resolve(true)),
    );

    this.cleanupAccessibility = applyModalAccessibility(this, {
      initialFocus: cancelEl,
    });
  }

  onClose(): void {
    if (!this.resolved) this.resolver(false);
    if (this.cleanupAccessibility) {
      this.cleanupAccessibility();
      this.cleanupAccessibility = null;
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
