import assert from "node:assert/strict";
import test from "node:test";
import { SerialTaskQueue } from "../src/serial-task-queue.ts";

test("serial task queue never overlaps tasks", async () => {
  const queue = new SerialTaskQueue();
  const events: string[] = [];
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const first = queue.run(async () => {
    events.push("first:start");
    await firstGate;
    events.push("first:end");
  });

  const second = queue.run(async () => {
    events.push("second:start");
    events.push("second:end");
  });

  await Promise.resolve();
  assert.deepEqual(events, ["first:start"]);

  releaseFirst();
  await Promise.all([first, second]);

  assert.deepEqual(events, ["first:start", "first:end", "second:start", "second:end"]);
});

test("serial task queue continues after a rejected task", async () => {
  const queue = new SerialTaskQueue();
  const events: string[] = [];

  const failed = queue.run(async () => {
    events.push("failed");
    throw new Error("expected");
  });

  const next = queue.run(async () => {
    events.push("next");
    return 42;
  });

  await assert.rejects(failed, /expected/);
  assert.equal(await next, 42);
  assert.deepEqual(events, ["failed", "next"]);
});
