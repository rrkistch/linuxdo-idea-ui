const { test, assert, openFixture, list, topic, requestCount, waitRequest, reply, hasText, navigate, settle, assertNative } = require("./browser-harness.cjs");
const fs = require("node:fs");
const path = require("node:path");

const results = (title, id = 1, more = false, postNumber = 1) => ({
  posts: [{ id: id * 10, topic_id: id, post_number: postNumber, username: "alice", blurb: '<b>Matched</b> <img src=x onerror="window.injected=true"> text' }],
  topics: [{ id, title, slug: `topic-${id}` }],
  grouped_search_result: { more_full_page_results: more },
});
const searchUrl = (q, page = 1) => `/search.json?q=${encodeURIComponent(q)}&page=${page}`;
async function submit(page, q) {
  await page.locator(".cx-search-input").fill(q);
  await page.locator(".cx-search-input").press("Enter");
}

test("workspace: direct search renders the shared shell and safely opens matching reply", async t => {
  const page = await openFixture(t, { route: "/search?q=cache" });
  await reply(page, searchUrl("cache"), results("Cache design", 42, false, 7));
  await hasText(page, ".cx-search-results", "Cache design");
  assert.match(await page.title(), /搜索 · cache · Codex/);
  assert.equal(await page.locator(".sidebar-wrapper").isVisible(), false);
  assert.equal(await page.locator(".community-banner").isVisible(), false);
  assert.equal(await page.locator(".codex-composer-wrap").isVisible(), false);
  assert.equal(await page.locator(".cx-search-results img").count(), 0);
  assert.equal(await page.evaluate(() => !!window.injected), false);
  await page.locator('.cx-search-result[href="/t/topic-42/42/7"]').click();
  await reply(page, "/t/42.json", topic("Cache design", 42));
  await reply(page, "/t/42/7.json", { post_stream: { posts: [{ id: 427, post_number: 7, username: "alice", cooked: "<p>Matched reply</p>" }], stream: [420, 427] } });
  await hasText(page, ".cx-thread-posts", "Matched reply");
});

test("workspace: empty search, keyboard shortcut, IME, filters and browser history", async t => {
  const page = await openFixture(t, { route: "/search" });
  await page.locator(".cx-search-input").waitFor();
  assert.equal(await requestCount(page, searchUrl("")), 0);
  await page.locator(".cx-search-input").fill("中文缓存");
  await page.locator(".cx-search-input").dispatchEvent("keydown", { key: "Enter", isComposing: true });
  await settle(page);
  assert.equal(await requestCount(page, searchUrl("中文缓存")), 0);
  await submit(page, "中文缓存");
  await reply(page, searchUrl("中文缓存"), results("中文结果"));
  await page.locator('[name="order"]').selectOption("latest");
  await page.locator('[name="category"]').fill("dev");
  await page.locator('[name="author"]').fill("alice");
  await page.locator(".cx-search-submit").click();
  const filtered = "中文缓存 order:latest category:dev user:alice";
  await reply(page, searchUrl(filtered), results("Filtered result"));
  assert.equal(new URL(page.url()).searchParams.get("q"), filtered);
  await page.goBack();
  await reply(page, searchUrl("中文缓存"), results("History result"));
  await hasText(page, ".cx-search-results", "History result");
  await page.goForward();
  await reply(page, searchUrl(filtered), results("Forward result"));
  await hasText(page, ".cx-search-results", "Forward result");
  await navigate(page, "/new");
  await reply(page, "/new.json", list("A topic"));
  await page.locator(".cx-md-edit").focus();
  await page.keyboard.press("Control+k");
  assert.equal(new URL(page.url()).pathname, "/new");
  await page.locator(".cx-md-edit").evaluate(el => el.blur());
  await page.keyboard.press("Control+k");
  await page.waitForFunction(() => document.activeElement?.matches(".cx-search-input"));
});

test("workspace: category/tag and user tabs use grouped search and real links", async t => {
  const page = await openFixture(t, { route: "/search?q=cache" });
  await reply(page, searchUrl("cache"), results("Post"));
  await page.locator('[data-search-type="taxonomy"]').click();
  await reply(page, "/search/query?term=cache", { categories: [{ id: 4, name: "开发", slug: "dev" }], tags: [{ id: 2234, name: "缓存", slug: "2234-tag" }] });
  assert.equal(await page.locator('.cx-search-results a[href="/c/dev/4"]').count(), 1);
  assert.equal(await page.locator('.cx-search-results a[href="/tag/2234-tag/2234"]').count(), 1);
  await page.locator('[data-search-type="users"]').click();
  await reply(page, "/search/query?term=cache&type_filter=user", { users: [{ username: "alice", name: "Alice" }] });
  assert.equal(await page.locator('.cx-search-results a[href="/u/alice"]').count(), 1);
});

test("workspace: slow search deduplicates, retries and discards old query/append responses", async t => {
  const page = await openFixture(t, { route: "/search?q=old" });
  await waitRequest(page, searchUrl("old"));
  for (let i = 0; i < 5; i++) {
    await page.evaluate(i => document.querySelector("#main-outlet").append(String(i)), i);
    await settle(page, 30);
  }
  assert.equal(await requestCount(page, searchUrl("old")), 1);
  await submit(page, "new");
  await reply(page, searchUrl("new"), {}, 503);
  await hasText(page, ".cx-search-status", "503");
  await page.locator(".cx-search-retry").click();
  await reply(page, searchUrl("new"), results("Current result", 2, true));
  await page.locator(".cx-search-more").click();
  await waitRequest(page, searchUrl("new", 2));
  await submit(page, "final");
  await reply(page, searchUrl("final"), results("Final result", 3, true));
  await page.locator(".cx-search-more").click();
  await waitRequest(page, searchUrl("final", 2));
  await reply(page, searchUrl("new", 2), results("Obsolete append", 4));
  await reply(page, searchUrl("old"), results("Obsolete query", 5));
  await page.locator(".cx-search-more").evaluate(el => el.click());
  assert.equal(await requestCount(page, searchUrl("final", 2)), 1);
  await reply(page, searchUrl("final", 2), results("Fresh append", 6));
  await hasText(page, ".cx-search-results", "Fresh append");
  assert.doesNotMatch(await page.locator(".cx-search-results").innerText(), /Obsolete/);
});

test("workspace: search pagination stops at ten and server errors permit page retry", async t => {
  const page = await openFixture(t, { route: "/search?q=pages" });
  await reply(page, searchUrl("pages"), results("Page 1", 1, true));
  await page.locator(".cx-search-more").click();
  await reply(page, searchUrl("pages", 2), { errors: ["Search unavailable"] });
  await hasText(page, ".cx-search-status", "Search unavailable");
  await page.locator(".cx-search-retry").click();
  await reply(page, searchUrl("pages", 2), results("Page 2", 2, true));
  for (let n = 3; n <= 10; n++) {
    await page.locator(".cx-search-more").click();
    await reply(page, searchUrl("pages", n), results(`Page ${n}`, n, true));
  }
  await hasText(page, ".cx-search-results", "Page 10");
  assert.equal(await page.locator(".cx-search-result").count(), 10);
  assert.equal(await page.locator(".cx-search-more").count(), 0);
});

test("workspace: search exit, native startup and challenge recovery retain lifecycle guards", async t => {
  const page = await openFixture(t, { route: "/search?q=late" });
  await waitRequest(page, searchUrl("late"));
  await navigate(page, "/search?q=late&cx_native=1");
  await settle(page);
  await assertNative(page);
  await reply(page, searchUrl("late"), results("Obsolete"));
  await settle(page);
  await assertNative(page);
  await page.locator("#codex-native-restore-btn").click();
  await reply(page, searchUrl("late"), results("Restored"));
  await hasText(page, ".cx-search-results", "Restored");
  await page.evaluate(() => document.title = "Just a moment...");
  await settle(page);
  await assertNative(page);
  await page.evaluate(() => document.title = "Linux DO fixture");
  await reply(page, searchUrl("late"), results("Recovered"));
  await hasText(page, ".cx-search-results", "Recovered");
  const native = await openFixture(t, { route: "/search?q=test&cx_native=1" });
  await assertNative(native);
  assert.equal(await native.evaluate(() => __harness.requests.length), 0);
});

test("workspace: projects are coherent, random on load, stable across routes and DOM updates", async t => {
  const projects = new Set();
  for (const random of [0, 0.21, 0.41, 0.61, 0.81]) {
    const page = await openFixture(t, { route: "/search", random });
    await page.locator("[data-workspace-id]").waitFor();
    projects.add(await page.locator("[data-workspace-id]").getAttribute("data-workspace-id"));
    const code = await page.locator("[data-code-body]").innerText();
    assert.ok(code.split("\n").length >= 80);
    assert.doesNotMatch(await page.locator(".cx-code-panel").innerText(), /演示|静态示例|装饰|linux-do|无代码片段/);
    await page.locator("[data-code-body]").evaluate(el => el.scrollTop = 350);
    const scroll = await page.locator("[data-code-body]").evaluate(el => el.scrollTop);
    await navigate(page, "/new");
    await reply(page, "/new.json", list("Project unchanged"));
    await page.evaluate(() => document.querySelector("#main-outlet").append("external"));
    await settle(page);
    assert.equal(await page.locator("[data-code-body]").innerText(), code);
    assert.equal(await page.locator("[data-code-body]").evaluate(el => el.scrollTop), scroll);
  }
  assert.equal(projects.size, 5);
});

test("workspace: file tabs close/reopen, diff matches file, manual projects and snippet opening work", async t => {
  const page = await openFixture(t, { route: "/search", random: 0, width: 1600 });
  await page.locator("[data-workspace-menu]").click();
  const project = await page.locator("[data-workspace-id]").getAttribute("data-workspace-id");
  await page.locator("[data-project-random]").click();
  assert.notEqual(await page.locator("[data-workspace-id]").getAttribute("data-workspace-id"), project);
  await page.locator("[data-workspace-menu]").click();
  await page.locator('[data-project-id="request-client"]').click();
  await page.locator("[data-file-menu]").click();
  await page.locator('[data-open-file="src/types.ts"]').click();
  await page.locator('[data-code-view-toggle] [data-v="diff"]').click();
  await hasText(page, "[data-code-body]", "无更改");
  await page.locator('[data-close-file="src/types.ts"]').click();
  await page.locator('[data-code-view-toggle] [data-v="code"]').click();
  await page.locator("[data-file-menu]").click();
  await page.locator('[data-open-file="src/types.ts"]').click();
  await hasText(page, "[data-code-body]", "RequestOptions");
  await page.locator('[data-select-file="src/client.ts"]').click();
  await page.locator('[data-code-view-toggle] [data-v="diff"]').click();
  await hasText(page, "[data-code-body]", "diff --git a/src/client.ts b/src/client.ts");
  if (process.env.CODEX_SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.CODEX_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.CODEX_SCREENSHOT_DIR, "workspace-diff-1600.png") });
  }
  await navigate(page, "/t/snippet/55");
  const data = topic("Snippet", 55);
  data.post_stream.posts[0].cooked = '<pre><code class="lang-python">print("original source")</code></pre>';
  await reply(page, "/t/55.json", data);
  assert.doesNotMatch(await page.locator("[data-code-body]").innerText(), /original source/);
  await page.locator(".cx-open-in-panel").click();
  await hasText(page, "[data-code-body]", 'print("original source")');
  assert.equal(await page.locator("[data-copy-snippet]").count(), 1);
  assert.equal(await page.locator("[data-locate-snippet]").count(), 1);
  await navigate(page, "/search");
  await settle(page);
  assert.doesNotMatch(await page.locator("[data-code-body]").innerText(), /original source/);
});

test("workspace: dark/light responsive layouts contain overflow and screenshots", async t => {
  for (const mode of ["dark", "light"]) {
    for (const width of [1600, 1280, 900, 390]) {
      const page = await openFixture(t, { route: "/search?q=cache", rootClass: `${mode}-scheme`, width, random: 0 });
      await reply(page, searchUrl("cache"), results("Reliable request caching", 42, true));
      await hasText(page, ".cx-search-results", "Reliable request caching");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator(".sidebar-wrapper").isVisible(), false);
      assert.equal(await page.locator(".cx-code-panel").isVisible(), width > 900);
      if (process.env.CODEX_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.CODEX_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.CODEX_SCREENSHOT_DIR, `search-${mode}-${width}.png`) });
      }
    }
  }
});
