import assert from "node:assert/strict";
import test from "node:test";
import {
  coerceScrippetParameterValue,
  formatScrippetParameterCssValue,
  parseScrippetParameterSchema,
  resolveScrippetParameterCssVarName,
  resolveScrippetParameterValues,
  shouldUseScrippetParameterSlider,
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
      control: "slider",
      "css-var": true,
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
  assert.equal(schema.margin.control, "slider");
  assert.equal(schema.margin.cssVar, true);
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

test("constructs CSS variable names from scrippet id and parameter key", () => {
  const schema = parseScrippetParameterSchema({
    "fade-width": { type: "number", default: 32, "css-var": true },
    explicit: {
      type: "number",
      default: 1,
      "css-var": "--scrippets-custom-override",
    },
    internal: { type: "number", default: 48 },
  });
  assert.ok(schema);

  assert.equal(
    resolveScrippetParameterCssVarName("toggle-wrap", "fade-width", schema["fade-width"]),
    "--scrippets-toggle-wrap-fade-width",
  );
  assert.equal(
    resolveScrippetParameterCssVarName("toggle-wrap", "explicit", schema.explicit),
    "--scrippets-custom-override",
  );
  assert.equal(
    resolveScrippetParameterCssVarName("toggle-wrap", "internal", schema.internal),
    undefined,
  );
});

test("uses sliders for bounded numbers unless the schema opts out", () => {
  const schema = parseScrippetParameterSchema({
    automatic: { type: "number", default: 50, min: 0, max: 100 },
    slider: { type: "number", default: 50, min: 0, max: 100, control: "slider" },
    number: { type: "number", default: 50, min: 0, max: 100, control: "number" },
    unbounded: { type: "number", default: 50 },
  });
  assert.ok(schema);

  assert.equal(shouldUseScrippetParameterSlider(schema.automatic), true);
  assert.equal(shouldUseScrippetParameterSlider(schema.slider), true);
  assert.equal(shouldUseScrippetParameterSlider(schema.number), false);
  assert.equal(shouldUseScrippetParameterSlider(schema.unbounded), false);
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
  assert.throws(
    () =>
      parseScrippetParameterSchema({
        bad: { type: "number", control: "slider", min: 0 },
      }),
    /must declare min and max/,
  );
  assert.throws(
    () => parseScrippetParameterSchema({ bad: { type: "string", control: "slider" } }),
    /can only use control when type is number/,
  );
});
