import assert from "node:assert/strict";
import test from "node:test";
import { shouldConfirmFirstRun, shouldConfirmStartupApproval } from "../src/execution-policy.ts";
import type { ScriptPreference } from "../src/types.ts";

function prefs(overrides: Partial<ScriptPreference> = {}): ScriptPreference {
  return { enabled: true, hasRun: false, ...overrides };
}

test("normal first-run confirmation respects the global setting", () => {
  assert.equal(shouldConfirmFirstRun({ confirmBeforeFirstRun: true }, prefs(), false), true);
  assert.equal(shouldConfirmFirstRun({ confirmBeforeFirstRun: false }, prefs(), false), false);
});

test("normal first-run confirmation is skipped after a run or for trusted folders", () => {
  assert.equal(
    shouldConfirmFirstRun({ confirmBeforeFirstRun: true }, prefs({ hasRun: true }), false),
    false,
  );
  assert.equal(shouldConfirmFirstRun({ confirmBeforeFirstRun: true }, prefs(), true), false);
});

test("startup approval is independent of normal run history", () => {
  assert.equal(shouldConfirmStartupApproval(prefs({ hasRun: true }), false), true);
});

test("startup approval is skipped only after approval or for trusted folders", () => {
  assert.equal(shouldConfirmStartupApproval(prefs({ startupApproved: true }), false), false);
  assert.equal(shouldConfirmStartupApproval(prefs(), true), false);
});
