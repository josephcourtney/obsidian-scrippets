import { normalizePath } from "obsidian";
import type { ScrippetMetadata } from "./types";

const METADATA_COMMENT = /^\s*\/\*([\s\S]*?)\*\//;
const DIRECTIVE = /@([\w-]+)\s*:\s*([^@]*)/g;

export interface ParsedMetadata {
  metadata: ScrippetMetadata;
  source: string;
}

export function parseScrippetMetadata(source: string): ParsedMetadata {
  const match = source.match(METADATA_COMMENT);
  if (!match) {
    return { metadata: {}, source };
  }

  const block = match[1];
  const metadata: ScrippetMetadata = {};
  let directive: RegExpExecArray | null;
  while ((directive = DIRECTIVE.exec(block)) !== null) {
    const key = directive[1]?.trim().toLowerCase();
    const value = directive[2]?.trim();
    if (!key || !value) continue;
    if (key === "description") metadata.description = value;
    else if (key === "desc") metadata.desc = value;
    else if (key === "name") metadata.name = value;
    else if (key === "id") metadata.id = value;
    else metadata[key as keyof ScrippetMetadata] = value;
  }

  return { metadata, source };
}

export function buildHeaderSnippet(source: string, maxLines = 10): string {
  const lines = source.split(/\r?\n/).slice(0, maxLines);
  if (lines.length === 0) return "";
  return lines
    .map((line) => escapeHtml(line))
    .map((line) => line.replace(/(@[\w-]+)(\s*:\s*)/g, '<mark>$1</mark>$2'))
    .join("<br>");
}

export function toDisplayName(filename: string, metadata: ScrippetMetadata): string {
  if (metadata.name) return metadata.name.trim();
  const base = getBasename(filename);
  return base.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function toIdentifier(filePath: string, metadata: ScrippetMetadata): string {
  if (metadata.id) return slugify(metadata.id);
  const base = getBasename(filePath).replace(/\.js$/i, "");
  return slugify(base);
}

export function getBasename(filePath: string): string {
  const normalized = normalizePath(filePath);
  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? normalized;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
