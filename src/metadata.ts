import { normalizePath, parseYaml, stringifyYaml } from "obsidian";
import type { ScrippetMetadata } from "./types";

const METADATA_COMMENT = /\/\*([\s\S]*?)\*\//;
const DIRECTIVE = /@([\w-]+)\s*:\s*([^@]*)/g;
const FRONTMATTER = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;

interface MetadataBlock {
  start: number;
  end: number;
  raw: string;
}

interface FrontmatterBlock extends MetadataBlock {
  data: Record<string, unknown>;
}

export interface ParsedMetadata {
  metadata: ScrippetMetadata;
  source: string;
  frontmatter?: FrontmatterBlock;
  comment?: MetadataBlock;
}

export function parseScrippetMetadata(source: string): ParsedMetadata {
  const metadata: ScrippetMetadata = {};
  let frontmatter: FrontmatterBlock | undefined;
  let comment: MetadataBlock | undefined;

  FRONTMATTER.lastIndex = 0;
  const frontmatterMatch = FRONTMATTER.exec(source);
  if (frontmatterMatch?.[0]) {
    const raw = frontmatterMatch[0];
    const data = safeParseYaml(frontmatterMatch[1]);
    if (data) {
      frontmatter = {
        start: 0,
        end: raw.length,
        raw,
        data,
      };
      applyMetadataRecord(metadata, data);
    }
  }

  const commentOffset = frontmatter?.end ?? 0;
  const commentMatch = matchCommentBlock(source, commentOffset);
  if (commentMatch) {
    const { raw, start, end } = commentMatch;
    comment = { raw, start, end };
    applyMetadataRecord(metadata, parseComment(raw));
  }

  return { metadata, source, frontmatter, comment };
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
  const base = getBasename(filePath).replace(/\.(?:c|m)?js$/i, "");
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

function safeParseYaml(raw: string): Record<string, unknown> | null {
  try {
    const parsed = parseYaml(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.warn("Scrippets: failed to parse YAML frontmatter", error);
  }
  return null;
}

function applyMetadataRecord(target: ScrippetMetadata, record: Record<string, unknown>): void {
  for (const [key, rawValue] of Object.entries(record)) {
    if (!isMetadataPrimitive(rawValue)) continue;
    const value = String(rawValue);
    const normalized = key.trim().toLowerCase();
    if (!normalized) continue;
    if (normalized === "description") target.description = value;
    else if (normalized === "desc") target.desc = value;
    else if (normalized === "name") target.name = value;
    else if (normalized === "id") target.id = value;
    else target[normalized as keyof ScrippetMetadata] = value;
  }
}

function parseComment(block: string): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  let directive: RegExpExecArray | null;
  DIRECTIVE.lastIndex = 0;
  while ((directive = DIRECTIVE.exec(block)) !== null) {
    const key = directive[1]?.trim().toLowerCase();
    const value = directive[2]?.trim();
    if (!key || !value) continue;
    meta[key] = value;
  }
  return meta;
}

function matchCommentBlock(source: string, offset: number): MetadataBlock | null {
  const slice = source.slice(offset);
  METADATA_COMMENT.lastIndex = 0;
  const match = METADATA_COMMENT.exec(slice);
  if (!match?.[0]) return null;
  const prefixIndex = slice.indexOf(match[0]);
  if (prefixIndex < 0) return null;
  const start = offset + prefixIndex;
  const raw = match[0];
  return {
    start,
    end: start + raw.length,
    raw,
  };
}

export function updateScrippetId(source: string, newId: string): string {
  const parsed = parseScrippetMetadata(source);
  if (parsed.frontmatter) {
    const next = { ...parsed.frontmatter.data, id: newId };
    const yaml = stringifyYaml(next).trimEnd();
    const replacement = `---\n${yaml}\n---\n`;
    return (
      source.slice(0, parsed.frontmatter.start) +
      replacement +
      source.slice(parsed.frontmatter.end)
    );
  }

  if (parsed.comment) {
    const updated = updateCommentId(parsed.comment.raw, newId);
    return source.slice(0, parsed.comment.start) + updated + source.slice(parsed.comment.end);
  }

  const header = `/* @id: ${newId} */\n`;
  return header + source;
}

function updateCommentId(block: string, newId: string): string {
  const idPattern = /(@id\s*:\s*)([^@\n]*)/i;
  if (idPattern.test(block)) {
    return block.replace(idPattern, (_match, prefix) => `${prefix}${newId}`);
  }
  const insertion = block.includes("\n") ? `\n * @id: ${newId}` : ` @id: ${newId}`;
  const closeIndex = block.lastIndexOf("*/");
  if (closeIndex === -1) {
    return `${block}${insertion}\n*/`;
  }
  return `${block.slice(0, closeIndex)}${insertion}\n${block.slice(closeIndex)}`;
}

function isMetadataPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
