import { App, Modal, Setting, normalizePath } from "obsidian";
import type { ScrippetDescriptor } from "../types";
import { applyModalAccessibility } from "./accessibility";

export function confirmFirstRun(app: App, descriptor: ScrippetDescriptor): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = new ConfirmRunModal(app, descriptor, resolve);
    modal.open();
  });
}

class ConfirmRunModal extends Modal {
  private readonly descriptor: ScrippetDescriptor;
  private readonly resolver: (value: boolean) => void;
  private resolved = false;
  private cleanupAccessibility: (() => void) | null = null;

  constructor(app: App, descriptor: ScrippetDescriptor, resolver: (value: boolean) => void) {
    super(app);
    this.descriptor = descriptor;
    this.resolver = resolver;
  }

  onOpen(): void {
    this.modalEl.addClass("scrippet-confirm-modal");
    this.titleEl.setText("Run scrippet?");
    this.contentEl.createEl("p", {
      text: `This is the first time running "${this.descriptor.name}". Only continue if you trust this code.`,
    });
    this.contentEl.createEl("p", {
      text: "Scrippets can read and modify anything in your vault and run with the same permissions as Obsidian.",
      cls: "scrippet-confirm-warning",
    });

    const details = this.contentEl.createEl("div", { cls: "scrippet-run-details" });
    details.createEl("p", { text: `File: ${normalizePath(this.descriptor.path)}` });
    details.createEl("p", { text: `ID: ${this.descriptor.id}` });

    const snippetId = `scrippet-snippet-${Date.now()}`;
    const snippetWrapper = this.contentEl.createEl("div", { cls: "scrippet-snippet-wrapper" });
    const snippet = snippetWrapper.createEl("pre", {
      cls: "scrippet-snippet",
      attr: { id: snippetId },
    });
    if (this.descriptor.headerSnippet) {
      snippet.innerHTML = this.descriptor.headerSnippet;
    } else {
      snippet.setText("No header comment found.");
    }

    const buttons = new Setting(this.contentEl);
    let cancelEl: HTMLElement | undefined;
    buttons.addButton((btn) => {
      cancelEl = btn.buttonEl;
      btn
        .setButtonText("Cancel")
        .setWarning()
        .onClick(() => {
          this.resolve(false);
        });
    });
    buttons.addButton((btn) =>
      btn
        .setButtonText("Run")
        .setCta()
        .onClick(() => {
          this.resolve(true);
        }),
    );

    this.cleanupAccessibility = applyModalAccessibility(this, {
      initialFocus: cancelEl,
      describedBy: snippetId,
    });
  }

  onClose(): void {
    if (!this.resolved) {
      this.resolver(false);
    }
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
