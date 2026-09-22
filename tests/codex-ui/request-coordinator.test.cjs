const test = require("node:test");
const assert = require("node:assert");

const codex = require("../../linuxdo-codex.user.js");

test("T04: RequestCoordinator A -> B race condition", async () => {
  const coordinator = new codex.RequestCoordinator("topic");

  // User clicks Topic A
  const reqA = coordinator.begin("topic:100");
  assert.strictEqual(coordinator.status, "loading");
  assert.strictEqual(coordinator.activeKey, "topic:100");

  // User immediately switches to Topic B
  const reqB = coordinator.begin("topic:200");
  assert.strictEqual(coordinator.status, "loading");
  assert.strictEqual(coordinator.activeKey, "topic:200");

  // Req A completes after Req B started
  const appliedA = coordinator.succeed(reqA.requestId, reqA.key);
  assert.strictEqual(appliedA, false, "Late response from Topic A must NOT be applied");
  assert.strictEqual(coordinator.loadedKey, null);
  assert.strictEqual(coordinator.activeKey, "topic:200");

  // Req B completes
  const appliedB = coordinator.succeed(reqB.requestId, reqB.key);
  assert.strictEqual(appliedB, true, "Response for Topic B should be applied");
  assert.strictEqual(coordinator.loadedKey, "topic:200");
  assert.strictEqual(coordinator.status, "ready");
});

test("T04: RequestCoordinator A -> B -> A out of order responses", async () => {
  const coordinator = new codex.RequestCoordinator("topic");

  // Click A (req 1)
  const reqA1 = coordinator.begin("topic:100");
  // Click B (req 2)
  const reqB = coordinator.begin("topic:200");
  // Click A again (req 3)
  const reqA2 = coordinator.begin("topic:100");

  assert.strictEqual(reqA1.requestId, 1);
  assert.strictEqual(reqB.requestId, 2);
  assert.strictEqual(reqA2.requestId, 3);

  // Req 1 (first A) arrives -> rejected because requestId is 1, current is 3
  assert.strictEqual(coordinator.succeed(reqA1.requestId, reqA1.key), false);

  // Req 2 (B) arrives -> rejected because requestId is 2, current is 3
  assert.strictEqual(coordinator.succeed(reqB.requestId, reqB.key), false);

  // Req 3 (second A) arrives -> accepted
  assert.strictEqual(coordinator.succeed(reqA2.requestId, reqA2.key), true);
  assert.strictEqual(coordinator.loadedKey, "topic:100");
  assert.strictEqual(coordinator.status, "ready");
});

test("T04: Same-page failure followed by retry", async () => {
  const coordinator = new codex.RequestCoordinator("topic");

  // First attempt fails
  const req1 = coordinator.begin("topic:300");
  assert.strictEqual(coordinator.status, "loading");

  const failed = coordinator.fail(req1.requestId, req1.key, new Error("HTTP 500"));
  assert.strictEqual(failed, true);
  assert.strictEqual(coordinator.status, "error");
  assert.strictEqual(coordinator.lastError?.message, "HTTP 500");

  // Retry attempt on same topic:300
  const req2 = coordinator.begin("topic:300");
  assert.strictEqual(req2.requestId, 2);
  assert.strictEqual(coordinator.status, "loading");
  assert.strictEqual(coordinator.lastError, null);

  // Retry succeeds
  const succeeded = coordinator.succeed(req2.requestId, req2.key);
  assert.strictEqual(succeeded, true);
  assert.strictEqual(coordinator.status, "ready");
  assert.strictEqual(coordinator.loadedKey, "topic:300");
});
