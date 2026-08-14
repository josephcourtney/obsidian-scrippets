import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCssSnippetParameterSchema,
  resolveCssSnippetRuntimeValues,
} from "../src/css-snippet-parameters.ts";

test("parses numeric parameters from annotated CSS custom properties", () => {
  const schema = parseCssSnippetParameterSchema(
    `
:root {
  /*
   * @scrippets-setting
   * label: Edge fade width
   * description: Width of the continuation fade.
   * min: 0px
   * max: 100px
   * step: 1px
   * control: slider
   */
  --scrippets-nowrap-fade-width: 32px;
}
`,
    "nowrap",
  );

  assert.ok(schema);
  assert.deepEqual(Object.keys(schema), ["fade-width"]);
  assert.equal(schema["fade-width"].type, "number");
  assert.equal(schema["fade-width"].label, "Edge fade width");
  assert.equal(schema["fade-width"].description, "Width of the continuation fade.");
  assert.equal(schema["fade-width"].default, 32);
  assert.equal(schema["fade-width"].unit, "px");
  assert.equal(schema["fade-width"].min, 0);
  assert.equal(schema["fade-width"].max, 100);
  assert.equal(schema["fade-width"].step, 1);
  assert.equal(schema["fade-width"].control, "slider");
  assert.equal(schema["fade-width"].cssVar, "--scrippets-nowrap-fade-width");
  assert.equal(schema["fade-width"].runtimeKey, undefined);
});

test("infers labels and string defaults", () => {
  const schema = parseCssSnippetParameterSchema(
    `
/*
@scrippets-setting
*/
--scrippets-theme-mode: compact;
`,
    "theme",
  );

  assert.ok(schema);
  assert.equal(schema.mode.type, "string");
  assert.equal(schema.mode.label, "Mode");
  assert.equal(schema.mode.default, "compact");
  assert.equal(schema.mode.cssVar, "--scrippets-theme-mode");
});

test("key exposes a CSS snippet parameter to invoke settings", () => {
  const schema = parseCssSnippetParameterSchema(
    `
/*
@scrippets-setting
key: fade-width
min: 0px
max: 100px
*/
--scrippets-nowrap-edge-width: 32px;
`,
    "nowrap",
  );

  assert.ok(schema);
  assert.equal(schema["fade-width"].runtimeKey, "fade-width");
  assert.deepEqual(resolveCssSnippetRuntimeValues(schema, undefined), {
    "fade-width": 32,
  });
  assert.deepEqual(resolveCssSnippetRuntimeValues(schema, { "fade-width": 55 }), {
    "fade-width": 55,
  });
});

test("CSS snippet bounds may omit a unit when the declaration supplies it", () => {
  const schema = parseCssSnippetParameterSchema(
    `
/*
@scrippets-setting
min: 0
max: 40
step: 1
*/
--scrippets-nowrap-scrollbar-offset: 12px;
`,
    "nowrap",
  );

  assert.ok(schema);
  assert.equal(schema["scrollbar-offset"].min, 0);
  assert.equal(schema["scrollbar-offset"].max, 40);
  assert.equal(schema["scrollbar-offset"].step, 1);
  assert.equal(schema["scrollbar-offset"].unit, "px");
});

test("rejects incompatible units and invalid annotation fields", () => {
  assert.throws(
    () =>
      parseCssSnippetParameterSchema(
        `
/*
@scrippets-setting
min: 0rem
max: 100rem
*/
--scrippets-nowrap-fade-width: 32px;
`,
        "nowrap",
      ),
    /uses unit "rem" but the custom property uses "px"/,
  );

  assert.throws(
    () =>
      parseCssSnippetParameterSchema(
        `
/*
@scrippets-setting
maximum: 100px
*/
--scrippets-nowrap-fade-width: 32px;
`,
        "nowrap",
      ),
    /unknown metadata field "maximum"/,
  );
});

test("rejects duplicate inferred setting keys", () => {
  assert.throws(
    () =>
      parseCssSnippetParameterSchema(
        `
/* @scrippets-setting */
--scrippets-nowrap-fade-width: 32px;
/* @scrippets-setting */
--scrippets-fade-width: 40px;
`,
        "nowrap",
      ),
    /duplicate setting key "fade-width"/,
  );
});
