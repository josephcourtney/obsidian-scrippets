import {
  formatScrippetParameterCssValue,
  resolveScrippetParameterCssVarName,
  resolveScrippetParameterValues,
} from "./parameters";
import type { ScrippetDescriptor, ScrippetParameterValues } from "./types";

interface PreviousCssValue {
  value: string;
  priority: string;
}

export class ScrippetParameterCssRegistry {
  private readonly previous = new Map<string, PreviousCssValue>();
  private applied = new Set<string>();

  sync(
    descriptors: readonly ScrippetDescriptor[],
    savedById: Record<string, ScrippetParameterValues>,
  ): void {
    const root = document.documentElement;
    const next = new Map<string, string>();
    const sorted = [...descriptors].sort((a, b) => a.id.localeCompare(b.id));

    for (const descriptor of sorted) {
      const schema = descriptor.metadata.settings;
      if (!schema) continue;
      const values = resolveScrippetParameterValues(schema, savedById[descriptor.id]);

      for (const [key, definition] of Object.entries(schema)) {
        const name = resolveScrippetParameterCssVarName(descriptor.id, key, definition);
        if (!name) continue;
        next.set(
          name,
          formatScrippetParameterCssValue(definition, values[key] ?? definition.default),
        );
      }
    }

    for (const name of this.applied) {
      if (!next.has(name)) this.restore(root, name);
    }

    for (const [name, value] of next) {
      if (!this.previous.has(name)) {
        this.previous.set(name, {
          value: root.style.getPropertyValue(name),
          priority: root.style.getPropertyPriority(name),
        });
      }
      root.style.setProperty(name, value);
    }

    this.applied = new Set(next.keys());
  }

  clear(): void {
    const root = document.documentElement;
    for (const name of [...this.applied]) {
      this.restore(root, name);
    }
    this.applied.clear();
    this.previous.clear();
  }

  private restore(root: HTMLElement, name: string): void {
    const previous = this.previous.get(name);
    if (previous?.value) {
      root.style.setProperty(name, previous.value, previous.priority);
    } else {
      root.style.removeProperty(name);
    }
    this.previous.delete(name);
    this.applied.delete(name);
  }
}
