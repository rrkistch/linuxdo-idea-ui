const { test, assert, openFixture, list, topic, requestCount, waitRequest, reply, hasText, navigate, scrollList, settle, assertNative } = require("./browser-harness.cjs");

test("startup: successful list and topic responses render through the real entry", async t => {
  const page = await openFixture(t);
  await reply(page, "/new.json", list("Startup topic"));
  await hasText(page, ".cx-thread-rows", "Startup topic");
  assert.ok(await page.evaluate(() => __harness.observers > 0), "observer instrumentation sees real theme observers");
  await page.locator('.cx-trow[data-topic-id="1"]').click();
  await reply(page, "/t/1.json", topic("Loaded topic", 1));
  await hasText(page, ".cx-thread-posts", "Loaded topic body");
});

test("startup: list HTTP failure remains visible and manual retry succeeds", async t => {
  const page = await openFixture(t);
  await reply(page, "/new.json", {}, 503);
  await hasText(page, ".cx-thread-rows", "HTTP 503");
  await settle(page);
  await page.locator(".cx-btn-retry").click();
  await waitRequest(page, "/new.json", 2);
  await reply(page, "/new.json", list("Retry succeeded"));
  await hasText(page, ".cx-thread-rows", "Retry succeeded");
  assert.equal(await requestCount(page, "/new.json"), 2);
});

test("startup: topic HTTP failure supports retry without an automatic request storm", async t => {
  const page = await openFixture(t, { route: "/t/fixture/42" });
  await reply(page, "/t/42.json", {}, 403);
  await hasText(page, ".cx-thread-posts", "HTTP 403");
  await page.evaluate(() => document.getElementById("main-outlet").append("external update"));
  await settle(page);
  assert.equal(await requestCount(page, "/t/42.json"), 1);
  await page.locator(".cx-btn-topic-retry").click();
  await reply(page, "/t/42.json", topic("Topic retry"));
  await hasText(page, ".cx-thread-posts", "Topic retry body");
});

test("startup: slow list survives continuous external DOM changes without abort/restart", async t => {
  const page = await openFixture(t, { honorAbort: true });
  await waitRequest(page, "/new.json");
  for (let i = 0; i < 10; i++) {
    await page.evaluate(i => document.getElementById("main-outlet").textContent = `Native update ${i}`, i);
    await settle(page, 35);
  }
  assert.equal(await requestCount(page, "/new.json"), 1);
  assert.equal(await page.evaluate(() => __harness.requests.find(r => r.url === "/new.json").aborted), false);
  await reply(page, "/new.json", list("Slow success"));
  await hasText(page, ".cx-thread-rows", "Slow success");
});

test("startup: static empty list stops applying the theme and refetching", async t => {
  const page = await openFixture(t);
  await reply(page, "/new.json", list(null));
  await settle(page, 250);
  const before = await page.evaluate(() => ({ frames: __harness.frames, writes: __harness.rootWrites }));
  await settle(page, 350);
  assert.deepEqual(await page.evaluate(() => ({ frames: __harness.frames, writes: __harness.rootWrites })), before);
  assert.equal(await requestCount(page, "/new.json"), 1);
  await hasText(page, ".cx-thread-rows", "暂无话题");
});

for (const options of [{ route: "/new?cx_native=1" }, { nativeSession: true }]) {
  test(`startup: native bypass precedes style, observers, tracking (${JSON.stringify(options)})`, async t => {
    const page = await openFixture(t, options);
    await settle(page, 1700); // Includes the CF watcher interval if incorrectly started.
    await assertNative(page);
    assert.deepEqual(await page.evaluate(() => ({ styles: __harness.styles, observers: __harness.observers, requests: __harness.requests.length, tracking: !!window.__codexReadTrackBound, watcher: !!window.__codexCfWatch })),
      { styles: 0, observers: 0, requests: 0, tracking: false, watcher: false });
    await page.locator("#codex-native-restore-btn").click();
    await reply(page, "/new.json", list("Restored"));
    await hasText(page, ".cx-thread-rows", "Restored");
    assert.equal(await page.evaluate(() => sessionStorage.getItem("codex_native_mode")), null);
  });
}

test("startup: native query persists even when the initial page is a challenge", async t => {
  const page = await openFixture(t, { route: "/new?cx_native=1", challenge: true });
  await page.evaluate(() => { document.querySelector("#challenge-form").remove(); document.title = "Linux DO fixture"; history.replaceState({}, "", "/new"); });
  await settle(page, 1700);
  await assertNative(page);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("codex_native_mode")), "1");
  assert.equal(await page.evaluate(() => __harness.styles), 0);
});

test("startup: challenge fallback recovers through normal activation", async t => {
  const page = await openFixture(t, { challenge: true });
  await assertNative(page);
  assert.equal(await page.evaluate(() => __harness.styles), 0);
  await page.evaluate(() => { document.querySelector("#challenge-form").remove(); document.title = "Linux DO fixture"; });
  await reply(page, "/new.json", list("Challenge cleared"));
  await hasText(page, ".cx-thread-rows", "Challenge cleared");
});

test("startup: route change cancels old list, returning to an old key starts a new owner", async t => {
  const page = await openFixture(t);
  await waitRequest(page, "/new.json");
  await navigate(page, "/top");
  await waitRequest(page, "/top.json");
  assert.equal(await page.evaluate(() => __harness.requests.find(r => r.url === "/new.json").aborted), true);
  await navigate(page, "/new");
  await waitRequest(page, "/new.json", 2);
  await reply(page, "/new.json", list("Current A"));
  await reply(page, "/top.json", list("Stale B", 2));
  await reply(page, "/new.json", list("Stale A", 3));
  await hasText(page, ".cx-thread-rows", "Current A");
  assert.doesNotMatch(await page.locator(".cx-thread-rows").innerText(), /Stale/);
});

for (const oldStatus of [200, 503]) {
test(`startup: stale append (${oldStatus}) cannot change a new page or release its loading guard`, async t => {
  const page = await openFixture(t);
  await reply(page, "/new.json", list("List A", 1, "/new.json?page=1"));
  await hasText(page, ".cx-thread-rows", "List A");
  await scrollList(page);
  await waitRequest(page, "/new.json?page=1");
  await navigate(page, "/top");
  await reply(page, "/top.json", list("List B", 2, "/top.json?page=1"));
  await hasText(page, ".cx-thread-rows", "List B");
  assert.equal(await page.evaluate(() => __harness.requests.find(r => r.url === "/new.json?page=1").aborted), true);
  await scrollList(page);
  await waitRequest(page, "/top.json?page=1");
  await reply(page, "/new.json?page=1", list("Stale append", 3, "/new.json?page=2"), oldStatus);
  await settle(page);
  await scrollList(page);
  await settle(page);
  assert.equal(await requestCount(page, "/top.json?page=1"), 1, "old finally must not clear B's loading flag");
  assert.equal(await requestCount(page, "/new.json?page=2"), 0);
  await reply(page, "/top.json?page=1", list("Fresh append", 4));
  await hasText(page, ".cx-thread-rows", "Fresh append");
  assert.doesNotMatch(await page.locator(".cx-thread-rows").innerText(), /Stale|List A/);
});
}

test("startup: explicit same-page refresh replaces pending list and invalidates old append", async t => {
  const page = await openFixture(t);
  await waitRequest(page, "/new.json");
  await page.locator('.cx-new-toggle-btn[data-mod="topics"]').click();
  await waitRequest(page, "/new.json", 2);
  assert.equal(await page.evaluate(() => __harness.requests.find(r => r.url === "/new.json").aborted), true);
  await reply(page, "/new.json", list("Forced list", 2, "/new.json?page=1"));
  await reply(page, "/new.json", list("Obsolete first page", 1));
  await hasText(page, ".cx-thread-rows", "Forced list");
  await scrollList(page);
  await waitRequest(page, "/new.json?page=1");
  await page.locator('.cx-new-toggle-btn[data-mod="all"]').click();
  await waitRequest(page, "/new.json", 3);
  await reply(page, "/new.json", list("Refreshed list", 3, "/new.json?page=1"));
  await hasText(page, ".cx-thread-rows", "Refreshed list");
  await scrollList(page);
  await waitRequest(page, "/new.json?page=1", 2);
  await reply(page, "/new.json?page=1", list("Obsolete append", 4), 200, 0);
  await scrollList(page);
  assert.equal(await requestCount(page, "/new.json?page=1"), 2);
  await reply(page, "/new.json?page=1", list("Current append", 5));
  await hasText(page, ".cx-thread-rows", "Current append");
  assert.doesNotMatch(await page.locator(".cx-thread-rows").innerText(), /Obsolete/);
});

test("startup: topic response after navigating to a native route cannot recreate the shell", async t => {
  const page = await openFixture(t, { route: "/t/fixture/42" });
  await waitRequest(page, "/t/42.json");
  await navigate(page, "/my/preferences");
  await settle(page);
  await reply(page, "/t/42.json", topic("Obsolete topic"));
  await settle(page);
  assert.equal(await page.locator(".codex-main").count(), 0);
  assert.doesNotMatch(await page.title(), /Obsolete/);
  assert.equal(await page.evaluate(() => __harness.requests.find(r => r.url === "/t/42.json").aborted), true);
});

test("startup: theme exit invalidates append requests and watcher respects native mode", async t => {
  const page = await openFixture(t);
  await reply(page, "/new.json", list("Before exit", 1, "/new.json?page=1"));
  await hasText(page, ".cx-thread-rows", "Before exit");
  await scrollList(page);
  await waitRequest(page, "/new.json?page=1");
  await navigate(page, "/new?cx_native=1");
  await settle(page);
  await assertNative(page);
  assert.equal(await page.evaluate(() => __harness.requests.find(r => r.url === "/new.json?page=1").aborted), true);
  await reply(page, "/new.json?page=1", list("Late after exit", 7));
  await settle(page, 1700);
  await assertNative(page);
  await page.locator("#codex-native-restore-btn").click();
  await reply(page, "/new.json", list("Clean restart", 8));
  await hasText(page, ".cx-thread-rows", "Clean restart");
  assert.doesNotMatch(await page.locator(".cx-thread-rows").innerText(), /Late after exit/);
});

test("startup: late topic cannot overwrite a restored theme; exit also stops reading reports", async t => {
  const page = await openFixture(t, { route: "/t/fixture/42" });
  await waitRequest(page, "/t/42.json");
  await navigate(page, "/t/fixture/42?cx_native=1");
  await settle(page);
  await assertNative(page);
  assert.equal(await page.evaluate(() => __harness.requests.find(r => r.url === "/t/42.json").aborted), true);
  await page.locator("#codex-native-restore-btn").click();
  await waitRequest(page, "/t/42.json", 2);
  await reply(page, "/t/42.json", topic("Current topic"));
  await reply(page, "/t/42.json", topic("Obsolete topic"));
  await hasText(page, ".cx-thread-posts", "Current topic body");
  await settle(page, 1100); // Accumulate a visible reading tick before opting out.
  await navigate(page, "/t/fixture/42?cx_native=1");
  await settle(page);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await assertNative(page);
  assert.equal(await page.locator("#codex-favicon").count(), 0);
  assert.doesNotMatch(await page.locator('link[rel="icon"]').getAttribute("href"), /^data:/);
});

test("startup: a title-only challenge during loading stays suspended until challenge clears", async t => {
  const page = await openFixture(t);
  await waitRequest(page, "/new.json");
  await page.evaluate(() => document.title = "Just a moment...");
  await settle(page, 1700);
  await assertNative(page);
  assert.equal(await page.title(), "Just a moment...");
  await page.evaluate(() => document.title = "Linux DO fixture");
  await waitRequest(page, "/new.json", 2);
  await reply(page, "/new.json", list("Challenge recovery", 3));
  await reply(page, "/new.json", list("Obsolete challenge response", 4));
  await hasText(page, ".cx-thread-rows", "Challenge recovery");
  assert.doesNotMatch(await page.locator(".cx-thread-rows").innerText(), /Obsolete/);
});

for (const conflict of ["class", "style"]) {
  test(`startup: other theme ${conflict} activation suspends requests and later recovery rejects stale responses`, async t => {
    const page = await openFixture(t);
    await waitRequest(page, "/new.json");
    await page.evaluate(conflict => {
      if (conflict === "class") document.documentElement.classList.add("idea-ide-theme");
      else { const style = document.createElement("style"); style.id = "linuxdo-feishu-theme"; document.head.append(style); }
    }, conflict);
    await settle(page);
    await assertNative(page);
    await page.evaluate(() => { document.documentElement.classList.remove("idea-ide-theme"); document.getElementById("linuxdo-feishu-theme")?.remove(); });
    await waitRequest(page, "/new.json", 2);
    await reply(page, "/new.json", list("New lifecycle", 9));
    await reply(page, "/new.json", list("Obsolete lifecycle", 10));
    await hasText(page, ".cx-thread-rows", "New lifecycle");
    assert.doesNotMatch(await page.locator(".cx-thread-rows").innerText(), /Obsolete/);
  });
}
