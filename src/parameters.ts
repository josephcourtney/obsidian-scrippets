import type {
  ScrippetParameterControl,
  ScrippetParameterDefinition,
  ScrippetParameterOption,
  ScrippetParameterSchema,
  ScrippetParameterType,
  ScrippetParameterValue,
  ScrippetParameterValues,
} from "./types";

const CSS_CUSTOM_PROPERTY = /^--scrippets-[A-Za-z0-9_-]+$/;
const PARAMETER_TYPES = new Set<ScrippetParameterType>(["boolean", "number", "string", "select"]);
const PARAMETER_CONTROLS = new Set<ScrippetParameterControl>(["auto", "slider", "number"]);

export function parseScrippetParameterSchema(raw: unknown): ScrippetParameterSchema | undefined {
  if (raw == null) return undefined;
  if (!isRecord(raw)) {
    throw new Error('Metadata "settings" must be a mapping/object.');
  }

  const schema: ScrippetParameterSchema = {};
  for (const [rawKey, rawDefinition] of Object.entries(raw)) {
    const key = rawKey.trim();
    if (!key) throw new Error("Scrippet setting names cannot be empty.");
    schema[key] = parseDefinition(key, rawDefinition);
  }

  return Object.keys(schema).length > 0 ? schema : undefined;
}

export function resolveScrippetParameterValues(
  schema: ScrippetParameterSchema | undefined,
  saved: ScrippetParameterValues | undefined,
): ScrippetParameterValues {
  if (!schema) return {};

  const resolved: ScrippetParameterValues = {};
  for (const [key, definition] of Object.entries(schema)) {
    const raw = saved?.[key];
    if (raw === undefined) {
      resolved[key] = definition.default;
      continue;
    }

    try {
      resolved[key] = coerceScrippetParameterValue(definition, raw);
    } catch {
      resolved[key] = definition.default;
    }
  }
  return resolved;
}

export function coerceScrippetParameterValue(
  definition: ScrippetParameterDefinition,
  raw: unknown,
): ScrippetParameterValue {
  switch (definition.type) {
    case "boolean":
      return coerceBoolean(raw);
    case "number":
      return coerceNumber(definition, raw);
    case "string":
      if (typeof raw !== "string") throw new Error("Expected a string value.");
      return raw;
    case "select": {
      if (typeof raw !== "string") throw new Error("Expected a select option value.");
      const allowed = definition.options?.some((option) => option.value === raw) ?? false;
      if (!allowed) throw new Error(`Unknown select option "${raw}".`);
      return raw;
    }
  }
}

export function formatScrippetParameterCssValue(
  definition: ScrippetParameterDefinition,
  value: ScrippetParameterValue,
): string {
  if (definition.type === "boolean") return value ? "1" : "0";
  if (definition.type === "number") return `${value}${definition.unit ?? ""}`;
  return String(value);
}

export function resolveScrippetParameterCssVarName(
  scrippetId: string,
  key: string,
  definition: ScrippetParameterDefinition,
): string | undefined {
  if (!definition.cssVar) return undefined;
  if (definition.cssVar !== true) return definition.cssVar;

  const idPart = toCssNamePart(scrippetId);
  const keyPart = toCssNamePart(key);
  if (!idPart || !keyPart) return undefined;
  return `--scrippets-${idPart}-${keyPart}`;
}

export function shouldUseScrippetParameterSlider(
  definition: ScrippetParameterDefinition,
): boolean {
  if (definition.type !== "number" || definition.control === "number") return false;
  const bounded =
    definition.min != null &&
    definition.max != null &&
    Number.isFinite(definition.min) &&
    Number.isFinite(definition.max) &&
    definition.max > definition.min;
  if (!bounded) return false;
  return definition.control === "slider" || definition.control == null || definition.control === "auto";
}

function parseDefinition(key: string, raw: unknown): ScrippetParameterDefinition {
  if (!isRecord(raw)) {
    throw new Error(`Scrippet setting "${key}" must be a mapping/object.`);
  }

  const type = parseType(key, raw.type);
  const label = readOptionalString(raw.label) ?? humanize(key);
  const description = readOptionalString(raw.description) ?? readOptionalString(raw.desc);
  const cssVar = parseCssVar(key, raw["css-var"] ?? raw.cssVar);
  const control = parseControl(key, type, raw.control);

  const base: Omit<ScrippetParameterDefinition, "default"> = {
    type,
    label,
    ...(description ? { description } : {}),
    ...(cssVar ? { cssVar } : {}),
  };

  if (type === "number") {
    const min = readOptionalFiniteNumber(raw.min, `${key}.min`);
    const max = readOptionalFiniteNumber(raw.max, `${key}.max`);
    const step = readOptionalFiniteNumber(raw.step, `${key}.step`);
    const unit = readOptionalString(raw.unit);

    if (min != null && max != null && min > max) {
      throw new Error(`Scrippet setting "${key}" has min greater than max.`);
    }
    if (step != null && step <= 0) {
      throw new Error(`Scrippet setting "${key}" must use a positive step.`);
    }
    if (control === "slider" && (min == null || max == null || max <= min)) {
      throw new Error(
        `Scrippet setting "${key}" uses a slider and must declare min and max with max greater than min.`,
      );
    }

    const definition: ScrippetParameterDefinition = {
      ...base,
      type,
      control,
      default: 0,
      ...(min != null ? { min } : {}),
      ...(max != null ? { max } : {}),
      ...(step != null ? { step } : {}),
      ...(unit ? { unit } : {}),
    };

    const fallback = min ?? 0;
    const defaultValue = raw.default === undefined ? fallback : raw.default;
    definition.default = coerceNumber(definition, defaultValue);
    return definition;
  }

  if (raw.min !== undefined || raw.max !== undefined || raw.step !== undefined || raw.unit !== undefined) {
    throw new Error(
      `Scrippet setting "${key}" can only use min, max, step, or unit when type is number.`,
    );
  }

  if (type === "boolean") {
    return {
      ...base,
      type,
      default: raw.default === undefined ? false : coerceBoolean(raw.default),
    };
  }

  if (type === "string") {
    if (raw.default !== undefined && typeof raw.default !== "string") {
      throw new Error(`Scrippet setting "${key}" default must be a string.`);
    }
    return {
      ...base,
      type,
      default: raw.default ?? "",
    };
  }

  const options = parseOptions(key, raw.options);
  const defaultValue = raw.default === undefined ? options[0]?.value : raw.default;
  if (typeof defaultValue !== "string") {
    throw new Error(`Scrippet setting "${key}" default must be a select option value.`);
  }
  if (!options.some((option) => option.value === defaultValue)) {
    throw new Error(
      `Scrippet setting "${key}" default "${defaultValue}" is not one of its options.`,
    );
  }

  return {
    ...base,
    type,
    default: defaultValue,
    options,
  };
}

function parseType(key: string, raw: unknown): ScrippetParameterType {
  if (typeof raw !== "string" || !PARAMETER_TYPES.has(raw as ScrippetParameterType)) {
    throw new Error(
      `Scrippet setting "${key}" must declare type boolean, number, string, or select.`,
    );
  }
  return raw as ScrippetParameterType;
}

function parseControl(
  key: string,
  type: ScrippetParameterType,
  raw: unknown,
): ScrippetParameterControl {
  if (raw == null) return "auto";
  if (type !== "number") {
    throw new Error(`Scrippet setting "${key}" can only use control when type is number.`);
  }
  if (typeof raw !== "string" || !PARAMETER_CONTROLS.has(raw as ScrippetParameterControl)) {
    throw new Error(`Scrippet setting "${key}" control must be auto, slider, or number.`);
  }
  return raw as ScrippetParameterControl;
}

function parseCssVar(key: string, raw: unknown): true | string | undefined {
  if (raw == null || raw === false) return undefined;
  if (raw === true) {
    if (!toCssNamePart(key)) {
      throw new Error(
        `Scrippet setting "${key}" cannot construct an automatic css-var name from its key.`,
      );
    }
    return true;
  }
  if (typeof raw !== "string") {
    throw new Error(
      `Scrippet setting "${key}" css-var must be true, false, or an explicit --scrippets-* custom property.`,
    );
  }

  const value = raw.trim();
  if (!CSS_CUSTOM_PROPERTY.test(value)) {
    throw new Error(
      `Scrippet setting "${key}" has invalid css-var "${value}". CSS custom properties must start with --scrippets-.`,
    );
  }
  return value;
}

function parseOptions(key: string, raw: unknown): ScrippetParameterOption[] {
  const options: ScrippetParameterOption[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") {
        options.push({ value: item, label: item });
        continue;
      }
      if (!isRecord(item) || typeof item.value !== "string") {
        throw new Error(
          `Scrippet setting "${key}" options must be strings or { value, label } mappings.`,
        );
      }
      options.push({
        value: item.value,
        label: readOptionalString(item.label) ?? item.value,
      });
    }
  } else if (isRecord(raw)) {
    for (const [value, label] of Object.entries(raw)) {
      if (typeof label !== "string") {
        throw new Error(`Scrippet setting "${key}" option labels must be strings.`);
      }
      options.push({ value, label });
    }
  } else {
    throw new Error(`Scrippet setting "${key}" must declare select options.`);
  }

  if (options.length === 0) {
    throw new Error(`Scrippet setting "${key}" must declare at least one select option.`);
  }

  const values = new Set<string>();
  for (const option of options) {
    if (!option.value) throw new Error(`Scrippet setting "${key}" has an empty option value.`);
    if (values.has(option.value)) {
      throw new Error(`Scrippet setting "${key}" has duplicate option "${option.value}".`);
    }
    values.add(option.value);
  }

  return options;
}

function coerceBoolean(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (raw === 1 || raw === "1" || raw === "true") return true;
  if (raw === 0 || raw === "0" || raw === "false") return false;
  throw new Error("Expected a boolean value.");
}

function coerceNumber(definition: ScrippetParameterDefinition, raw: unknown): number {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : Number.NaN;

  if (!Number.isFinite(value)) throw new Error("Expected a finite number.");

  let normalized = value;
  if (definition.min != null) normalized = Math.max(definition.min, normalized);
  if (definition.max != null) normalized = Math.min(definition.max, normalized);
  return normalized;
}

function readOptionalString(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value || undefined;
}

function readOptionalFiniteNumber(raw: unknown, path: string): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new Error(`Scrippet setting "${path}" must be a finite number.`);
  }
  return raw;
}

function humanize(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function toCssNamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
