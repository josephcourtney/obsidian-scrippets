import type { ScrippetMetadata } from "./types";

export function getRequiredSnippetId(metadata: ScrippetMetadata): string | undefined {
  const raw = metadata["requires-snippet"];
  if (raw == null) return undefined;

  let id = raw.trim();
  if (!id) {
    throw new Error('Metadata "requires-snippet" must name a CSS snippet.');
  }

  if (id.toLowerCase().endsWith(".css")) {
    id = id.slice(0, -4).trim();
  }

  if (!id || id === "." || id === ".." || /[\\/]/.test(id)) {
    throw new Error(
      `Invalid CSS snippet id "${raw.trim()}". Use a snippet name, not a path.`,
    );
  }

  return id;
}
