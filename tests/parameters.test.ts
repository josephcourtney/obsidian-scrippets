import assert from "node:assert/strict";
import test from "node:test";
import {
  coerceScrippetParameterValue,
  formatScrippetParameterCssValue,
  parseScrippetParameterSchema,
  resolveScrippetParameterValues,
} from "../src/parameters.ts";

test("parses supported parameter types and defaults", () => {
  const schema = parseScrippetParameterSchema({
    enabled: { type: "boolean", label: "Enabled", default: true },
    margin: {
      type: "number",
      label: "Margin",
      default: 48,
      min: 0,
      max: 200,
      unit: "px",
      "css-var": "--scrippets-margin",
    },
    title: { type: "string", default: "Example" },
    mode: {
      type: "select",
      options: { compact: "Compact", comfortable: "Comfortable" },
      default: "comfortable",
    },
  });

  assert.ok(schema);
  assert.equal(schema.enabled.default, true);
  assert.equal(schema.margin.default, 48);
  assert.equal(schema.margin.cssVar, "--scrippets-margin");
  assert.equal(schema.title.label, "Title");
  assert.deepEqual(schema.mode.options, [
    { value: "compact", label: "Compact" },
    { value: "comfortable", label: "Comfortable" },
  ]);
});

test("resolves saved values and falls back from stale values", () => {
  const schema = parseScrippetParameterSchema({
    margin: { type: "number", default: 48, min: 0, max: 100 },
    mode: { type: "select", options: ["compact", "comfortable"], default: "compact" },
  });
  assert.ok(schema);

  assert.deepEqual(
    resolveScrippetParameterValues(schema, {
      margin: 500,
      mode: "removed-option",
    }),
    {
      margin: 100,
      mode: "compact",
    },
  );
});

test("coerces UI values and formats CSS values", () => {
  const schema = parseScrippetParameterSchema({
    margin: { type: "number", default: 32, min: 0, max: 100, unit: "px" },
    enabled: { type: "boolean" },
  });
  assert.ok(schema);

  assert.equal(coerceScrippetParameterValue(schema.margin, "44"), 44);
  assert.equal(coerceScrippetParameterValue(schema.enabled, "true"), true);
  assert.equal(formatScrippetParameterCssValue(schema.margin, 44), "44px");
  assert.equal(formatScrippetParameterCssValue(schema.enabled, false), "0");
});

test("rejects invalid schemas", () => {
  assert.throws(
    () => parseScrippetParameterSchema({ bad: { type: "number", min: 10, max: 5 } }),
    /min greater than max/,
  );
  assert.throws(
    () => parseScrippetParameterSchema({ bad: { type: "select", options: [] } }),
    /at least one select option/,
  );
  assert.throws(
    () =>
      parseScrippetParameterSchema({
        bad: { type: "number", "css-var": "--text-normal" },
      }),
    /must start with --scrippets-/,
  );
});
