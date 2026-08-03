import assert from "node:assert/strict";
import test from "node:test";
import { evaluateScrippetSource } from "../src/scrippet-runtime.ts";

const plugin = { app: {} };
class NoticeStub {}

function evaluate(source: string): unknown {
  return evaluateScrippetSource(plugin, plugin.app, NoticeStub, source);
}

test("loads CommonJS class exports", () => {
  const result = evaluate(`module.exports = class Example { invoke() {} };`);
  assert.equal(typeof result, "function");
});

test("loads CommonJS object exports", () => {
  const result = evaluate(`const invoke = () => {}; module.exports = { invoke };`);
  assert.equal(typeof (result as { invoke: unknown }).invoke, "function");
});

test("loads defaultExport declarations", () => {
  const result = evaluate(`const defaultExport = class Example { invoke() {} };`);
  assert.equal(typeof result, "function");
});

test("loads bare invoke declarations", () => {
  const result = evaluate(`const invoke = () => {};`);
  assert.equal(typeof (result as { invoke: unknown }).invoke, "function");
});

test("loads conventional Scrippet declarations", () => {
  const result = evaluate(`class Scrippet { invoke() {} }`);
  assert.equal(typeof result, "function");
});

test("does not let an untouched empty module.exports mask other forms", () => {
  const result = evaluate(`const defaultExport = { invoke() {} };`);
  assert.equal(typeof (result as { invoke: unknown }).invoke, "function");
});
