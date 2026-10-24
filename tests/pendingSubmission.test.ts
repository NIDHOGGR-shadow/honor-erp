import { test } from "node:test";
import assert from "node:assert/strict";
import { PendingSubmission } from "../src/online/pendingSubmission";

test("unsent authentication waits for readiness, then sends exactly once", async () => {
  const pending = new PendingSubmission(); let sends = 0;
  pending.hold(async () => { sends++; }, 0);
  assert.equal(await pending.reconnect(async () => false, 1), "waiting");
  assert.equal(sends, 0);
  assert.equal(await pending.reconnect(async () => true, 2), "sent");
  assert.equal(await pending.reconnect(async () => true, 3), "cancelled");
  assert.equal(sends, 1);
});
test("cancel while the readiness check is running prevents submission", async () => {
  const pending = new PendingSubmission(); let sends = 0;
  pending.hold(async () => { sends++; }, 0);
  const result = pending.reconnect(async () => { pending.cancel(); return true; }, 1);
  assert.equal(await result, "cancelled"); assert.equal(sends, 0);
});
test("expired drafts do not send and ambiguous authentication failures are not replayed", async () => {
  const pending = new PendingSubmission(); let sends = 0;
  pending.hold(async () => { sends++; }, 0);
  assert.equal(await pending.reconnect(async () => true, 300_001), "expired");
  pending.hold(async () => { sends++; throw new Error("Response lost"); }, 0);
  await assert.rejects(pending.reconnect(async () => true, 1), /Response lost/);
  assert.equal(await pending.reconnect(async () => true, 2), "cancelled");
  assert.equal(sends, 1);
});
