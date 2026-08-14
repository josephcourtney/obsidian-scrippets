import assert from "node:assert/strict";
import test from "node:test";
import { getRequiredSnippetId } from "../src/snippet-dependency.ts";

test("returns undefined when no snippet dependency is declared", () => {
  assert.equal(getRequiredSnippetId({}), undefined);
});

test("normalizes declared snippet ids", () => {
  assert.equal(getRequiredSnippetId({ "requires-snippet": " nowrap " }), "nowrap");
  assert.equal(getRequiredSnippetId({ "requires-snippet": "nowrap.css" }), "nowrap");
});

test("rejects empty snippet dependencies", () => {
  assert.throws(
    () => getRequiredSnippetId({ "requires-snippet": "   " }),
    /must name a CSS snippet/,
  );
});

test("rejects snippet paths", () => {
  assert.throws(
    () => getRequiredSnippetId({ "requires-snippet": "../nowrap" }),
    /Use a snippet name, not a path/,
  );
  assert.throws(
    () => getRequiredSnippetId({ "requires-snippet": "nested\\nowrap" }),
    /Use a snippet name, not a path/,
  );
});
