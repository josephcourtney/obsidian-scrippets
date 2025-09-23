import { Modal } from "obsidian";

export interface ModalAccessibilityOptions {
  initialFocus?: HTMLElement;
  describedBy?: string;
}

export function applyModalAccessibility(
  modal: Modal,
  options: ModalAccessibilityOptions = {},
): () => void {
  const { modalEl, titleEl } = modal;
  const existingId = titleEl.getAttr("id");
  const titleId = existingId && existingId.length > 0 ? existingId : `scrippet-modal-title-${Date.now()}`;
  titleEl.setAttr("id", titleId);

  modalEl.setAttr("role", "dialog");
  modalEl.setAttr("aria-modal", "true");
  modalEl.setAttr("aria-labelledby", titleId);
  if (options.describedBy) {
    modalEl.setAttr("aria-describedby", options.describedBy);
  }

  const focusableSelector =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const getFocusable = (): HTMLElement[] =>
    Array.from(modalEl.querySelectorAll<HTMLElement>(focusableSelector)).filter(
      (element) => !element.hasAttribute("disabled"),
    );

  const focusFirst = () => {
    const targets = getFocusable();
    const initial = options.initialFocus ?? targets[0];
    if (initial) {
      initial.focus({ preventScroll: true });
    }
  };

  const keyHandler = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const elements = getFocusable();
    if (elements.length === 0) return;
    const first = elements[0]!;
    const last = elements[elements.length - 1]!;
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      }
    } else if (document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  modalEl.addEventListener("keydown", keyHandler);
  window.setTimeout(focusFirst, 0);

  return () => {
    modalEl.removeEventListener("keydown", keyHandler);
    if (options.describedBy) {
      modalEl.removeAttribute("aria-describedby");
    }
  };
}
