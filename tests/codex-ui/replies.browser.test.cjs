const { test, assert, openFixture, topic, reply, hasText, navigate, settle, requestCount, waitRequest, assertNative } = require("./browser-harness.cjs");
const fs = require("node:fs");
const path = require("node:path");

function post(n, parent = 2, topicId = 42) {
  return { id: topicId * 10 + n, topic_id: topicId, post_number: n, username: `dev${n}`, reply_to_post_number: parent,
    cooked: `<p>跟进 #${n}：${n % 2 ? "可以在请求结束时清理监听器，取消时保留原始原因。" : "重试开始前也检查一次信号状态，避免已取消的请求再次发出。"}</p>` };
}
function thread(topicId = 42, count = 2, local = true) {
  const data = topic("请求客户端的取消与重试", topicId);
  data.post_stream.posts[0].cooked = "<p>每个请求都需要独立取消，怎样组织客户端中的信号与清理逻辑？</p>";
  data.post_stream.posts.push({ ...post(2, null, topicId), reply_count: count, cooked: "<p>建议把取消信号作为每次调用的参数，而不是保存在客户端实例上。</p>" });
  if (local) data.post_stream.posts.push(post(3, 2, topicId));
  data.posts_count = data.post_stream.posts.length;
  data.post_stream.stream = data.post_stream.posts.map(p => p.id);
  return data;
}
async function openThread(t, { data = thread(), ...options } = {}) {
  const page = await openFixture(t, { route: "/t/client/42", random: 0, ...options });
  await reply(page, "/t/42.json", data);
  await page.locator('.cx-reply-branch[data-parent-post="422"]').waitFor();
  return page;
}
const branch = page => page.locator('.cx-reply-branch[data-parent-post="422"]');

test("replies: parent context follows its own body and names both floors", async t => {
  const data = thread();
  // Public topic 2946712: 8 replies to 6, and 9 replies to 8.
  const question = '话说一个账号支持同时在几个codex上登录使用啊';
  const answer = '一般是2个，超过2个就有降智的风险；建议专号 专事儿，';
  data.post_stream.posts.push(post(6, null),
    { ...post(8, 6), username: 'wanlan', cooked: `<p>${question}</p>`, reply_count: 1 },
    { ...post(9, 8), username: 'ndj888', cooked: `<p>${answer}</p>` }, post(10, 10));
  const page = await openThread(t, { data });
  const turn = page.locator('.cx-turn-agent[data-post-number="9"]');
  await hasText(page, '.cx-turn-agent[data-post-number="9"] .cx-parent-label', '9 楼回复 @wanlan · #8');
  await hasText(page, '.cx-turn-agent[data-post-number="8"] .cx-parent-label', '8 楼回复 @dev6 · #6');
  await turn.locator('.cx-parent-context summary').click();
  assert.equal(await turn.locator('.cx-cooked').innerText(), answer);
  assert.equal(await turn.locator('.cx-parent-body .cx-branch-cooked').innerText(), question);
  const eighthBranch = page.locator('[data-branch-parent="8"]');
  await eighthBranch.locator('summary').click();
  assert.equal(await eighthBranch.locator('.cx-branch-reply').getAttribute('data-post-number'), '9');
  assert.equal(await eighthBranch.locator('.cx-branch-cooked').innerText(), answer);
  assert.equal(await turn.evaluate(el => el.querySelector('.cx-cooked').compareDocumentPosition(el.querySelector('.cx-parent-slot')) & Node.DOCUMENT_POSITION_FOLLOWING), 4);
  assert.equal(await page.locator('.cx-turn-agent[data-post-number="10"] .cx-parent-context').count(), 0);
});

test("replies: author hover and keyboard open a safe profile card with a real homepage link", async t => {
  const page = await openThread(t);
  const author = page.locator('.cx-worked [data-cx-user="dev2"]');
  assert.equal(await author.getAttribute('href'), '/u/dev2');
  await author.hover();
  await reply(page, '/u/dev2.json', { user: { username: 'dev2', name: 'Developer Two', bio_raw: '<img src=x onerror=alert(1)>bio', location: 'Shanghai' } });
  await hasText(page, '.cx-user-card', 'Developer Two');
  assert.equal(await page.locator('.cx-user-card img').count(), 0);
  assert.equal(await page.locator('.cx-user-card a').getAttribute('href'), '/u/dev2');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.cx-user-card').count(), 0);
  const next = page.locator('.cx-worked [data-cx-user="dev3"]');
  await next.focus();
  await reply(page, '/u/dev3.json', {}, 503);
  await hasText(page, '.cx-user-card', '资料暂时无法加载');
  assert.equal(await page.locator('.cx-user-card a').getAttribute('href'), '/u/dev3');
  await navigate(page, '/new?cx_native=1');
  await settle(page);
  assert.equal(await page.locator('.cx-user-card').count(), 0);
});

test("replies: clicking authors rejects old profile responses after switching and leaving", async t => {
  const page = await openThread(t);
  await page.locator('.cx-worked [data-cx-user="dev2"]').click();
  await waitRequest(page, '/u/dev2.json');
  await page.locator('.cx-worked [data-cx-user="dev3"]').focus();
  await reply(page, '/u/dev3.json', { user: { username: 'dev3', name: 'Current author' } });
  await reply(page, '/u/dev2.json', { user: { username: 'dev2', name: 'Stale author' } });
  await hasText(page, '.cx-user-card', 'Current author');
  assert.equal(await page.locator('.cx-user-card').getAttribute('data-username'), 'dev3');
  await page.keyboard.press('Escape');
  await page.locator('.cx-worked [data-cx-user="dev2"]').click();
  await waitRequest(page, '/u/dev2.json', 2);
  await navigate(page, '/new?cx_native=1');
  await reply(page, '/u/dev2.json', { user: { username: 'dev2', name: 'Stale author' } });
  await settle(page);
  assert.equal(await page.locator('.cx-user-card').count(), 0);
});

test("replies: profile dates show registration and last seen, with missing or invalid values unavailable", async t => {
  const page = await openThread(t);
  await page.locator('.cx-worked [data-cx-user="dev2"]').hover();
  await reply(page, '/u/dev2.json', { user: {
    username: 'dev2', created_at: '2023-04-15T06:30:00Z', last_seen_at: '2026-09-24T08:45:00Z'
  } });
  await hasText(page, '.cx-user-dates', '注册时间：');
  await hasText(page, '.cx-user-dates', '最后活动时间：');
  const times = page.locator('.cx-user-dates time');
  assert.equal(await times.nth(0).getAttribute('datetime'), '2023-04-15T06:30:00.000Z');
  assert.equal(await times.nth(1).getAttribute('datetime'), '2026-09-24T08:45:00.000Z');
  assert.match(await times.nth(0).innerText(), /2023.*04.*15/);
  assert.match(await times.nth(1).innerText(), /2026.*09.*24/);
  await page.locator('.cx-worked [data-cx-user="dev3"]').focus();
  await reply(page, '/u/dev3.json', { user: {
    username: 'dev3', created_at: 'invalid-date', last_seen_at: null, last_posted_at: '2026-09-24T08:45:00Z'
  } });
  await hasText(page, '.cx-user-dates', '注册时间：未提供');
  await hasText(page, '.cx-user-dates', '最后活动时间：未提供');
  assert.equal(await page.locator('.cx-user-dates time').count(), 0);
});

test("replies: a reply exposes its local parent without a request or navigation", async t => {
  const page = await openThread(t);
  const context = page.locator('.cx-turn-agent[data-post-number="3"] .cx-parent-context');
  await hasText(page, '.cx-turn-agent[data-post-number="3"] .cx-parent-label', '回复 @dev2 · #2');
  await context.locator('summary').focus();
  await page.keyboard.press('Enter');
  await hasText(page, '.cx-turn-agent[data-post-number="3"] .cx-parent-context', '建议把取消信号');
  assert.equal(await requestCount(page, '/t/42/2.json'), 0);
  await context.locator('[data-branch-locate]').click();
  await page.locator('.cx-turn-agent[data-post-number="2"].cx-jump-highlight').waitFor();
});

test("replies: missing parent loads lazily, retries, deduplicates and rejects stale responses", async t => {
  const data = thread();
  data.post_stream.posts.push(post(9, 7), post(10, 7));
  const page = await openThread(t, { data });
  const context = page.locator('.cx-turn-agent[data-post-number="9"] .cx-parent-context');
  assert.equal(await requestCount(page, '/t/42/7.json'), 0);
  await context.locator('summary').click();
  await page.locator('.cx-turn-agent[data-post-number="10"] .cx-parent-context summary').click();
  assert.equal(await requestCount(page, '/t/42/7.json'), 1);
  await reply(page, '/t/42/7.json', {}, 503);
  await context.getByRole('button', { name: '重试' }).click();
  await reply(page, '/t/42/7.json', { id: 42, post_stream: { posts: [post(7, null)] } });
  await hasText(page, '.cx-turn-agent[data-post-number="9"] .cx-parent-context', '跟进 #7');
  assert.equal(await page.locator('.cx-thread-posts > .cx-turn-agent[data-post-number="7"]').count(), 0);
  await navigate(page, '/search');
  await page.locator('.cx-search-input').waitFor();
  await navigate(page, '/t/client/42');
  await reply(page, '/t/42.json', data);
  await context.locator('summary').click();
  await waitRequest(page, '/t/42/7.json', 3);
  await navigate(page, '/new?cx_native=1');
  await reply(page, '/t/42/7.json', { id: 42, post_stream: { posts: [post(7, null)] } });
  await settle(page);
  await assertNative(page);
});

test("replies: local direct replies expand below their parent and retain real reply targets", async t => {
  const data = thread(42, 1);
  data.post_stream.posts.push(post(4, 3));
  data.posts_count = data.post_stream.posts.length;
  data.post_stream.stream = data.post_stream.posts.map(p => p.id);
  const page = await openThread(t, { data });
  const group = branch(page);
  await hasText(page, '.cx-reply-branch[data-parent-post="422"] > summary', "1 条回复");
  assert.equal(await group.getAttribute("open"), null);
  await group.locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  await hasText(page, '.cx-reply-branch[data-parent-post="422"]', "跟进 #3");
  assert.doesNotMatch(await group.innerText(), /跟进 #4/);
  assert.equal(await requestCount(page, "/posts/422/replies.json"), 0);
  assert.equal(await group.locator(".cx-turn-activity").count(), 0, "branch content never gets simulated activity");
  await group.locator('[data-action="reply"]').click();
  await hasText(page, ".cx-compose-target", "dev3 · #3");
  await group.locator("[data-branch-locate]").click();
  await page.locator('.cx-turn-agent[data-post-number="3"].cx-jump-highlight').waitFor();
});

test("replies: remote pages deduplicate, retain loaded replies on failure, and retry in place", async t => {
  const page = await openThread(t, { data: thread(42, 23) });
  const group = branch(page);
  await group.locator(":scope > summary").click();
  await hasText(page, '.cx-reply-branch[data-parent-post="422"]', "跟进 #3");
  await waitRequest(page, "/posts/422/replies.json");
  await group.locator(":scope > summary").click();
  await group.locator(":scope > summary").click();
  assert.equal(await requestCount(page, "/posts/422/replies.json"), 1);
  await reply(page, "/posts/422/replies.json", {}, 503);
  await hasText(page, ".cx-branch-status", "503");
  await group.getByRole("button", { name: "重试" }).click();
  await reply(page, "/posts/422/replies.json", Array.from({ length: 20 }, (_, i) => post(i + 3)));
  await page.waitForFunction(() => document.querySelectorAll('.cx-reply-branch[data-parent-post="422"] .cx-branch-reply').length === 20);
  await group.getByRole("button", { name: "加载更多回复" }).click();
  await reply(page, "/posts/422/replies.json?after=22", {}, 502);
  await hasText(page, ".cx-branch-status", "502");
  assert.equal(await group.locator(".cx-branch-reply").count(), 20);
  await group.getByRole("button", { name: "重试" }).click();
  await reply(page, "/posts/422/replies.json?after=22", [post(23), post(24), post(25)]);
  await page.waitForFunction(() => document.querySelectorAll('.cx-reply-branch[data-parent-post="422"] .cx-branch-reply').length === 23);
  assert.equal(await group.getByRole("button", { name: "加载更多回复" }).count(), 0);
});

test("replies: route changes and native exit cancel branches and reject late responses", async t => {
  const page = await openThread(t);
  await branch(page).locator(":scope > summary").click();
  await waitRequest(page, "/posts/422/replies.json");
  await navigate(page, "/t/next/52");
  await reply(page, "/t/52.json", thread(52, 3));
  const next = page.locator('.cx-reply-branch[data-parent-post="522"]');
  await next.locator(":scope > summary").click();
  await waitRequest(page, "/posts/522/replies.json");
  await reply(page, "/posts/422/replies.json", [post(9)]);
  assert.doesNotMatch(await page.locator(".cx-thread-posts").innerText(), /跟进 #9/);
  await next.locator(":scope > summary").click();
  await next.locator(":scope > summary").click();
  assert.equal(await requestCount(page, "/posts/522/replies.json"), 1);
  await navigate(page, "/new?cx_native=1");
  await page.locator("#codex-native-restore-btn").waitFor();
  await reply(page, "/posts/522/replies.json", [post(7, 2, 52)]);
  await settle(page);
  await assertNative(page);
  assert.equal(await page.evaluate(() => __harness.requests.filter(r => /\/replies.json/.test(r.url)).every(r => r.aborted)), true);
});

test("replies: remote reply code opens with its own source and can locate a missing floor", async t => {
  const page = await openThread(t, { data: thread(42, 1, false) });
  await branch(page).locator(":scope > summary").click();
  const remote = { ...post(8), username: 'dev<unsafe>', cooked: '<p>远端回复</p><pre><code class="lang-js">const abort = true;</code></pre>' };
  await reply(page, "/posts/422/replies.json", [remote, post(9, 7), post(10, 2, 99)]);
  const group = branch(page);
  await hasText(page, '.cx-reply-branch[data-parent-post="422"]', "远端回复");
  assert.equal(await group.locator(".cx-branch-reply").count(), 1, "unrelated parent/topic responses are excluded");
  assert.equal(await group.locator("unsafe").count(), 0);
  await group.locator(".cx-open-in-panel").click();
  await hasText(page, "[data-code-body]", "const abort = true;");
  await page.locator("[data-locate-snippet]").click();
  await reply(page, "/t/42/8.json", { post_stream: { posts: [remote], stream: [420, 422, 428] } });
  await page.locator('.cx-turn-agent[data-post-number="8"].cx-jump-highlight').waitFor();
  await group.locator('[data-action="reply"]').click();
  await hasText(page, ".cx-compose-target", "dev<unsafe> · #8");
});

test("replies: branch discussions fit light/dark and narrow layouts", async t => {
  for (const mode of ["dark", "light"]) for (const width of [1600, 390]) {
    const data = thread(42, 2);
    data.post_stream.posts.push(post(4));
    data.posts_count = data.post_stream.posts.length;
    data.post_stream.stream = data.post_stream.posts.map(p => p.id);
    const page = await openThread(t, { data, rootClass: `${mode}-scheme`, width });
    await branch(page).locator(":scope > summary").click();
    await hasText(page, '.cx-reply-branch[data-parent-post="422"]', "跟进 #4");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.CODEX_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.CODEX_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.CODEX_SCREENSHOT_DIR, `branch-${mode}-${width}.png`) });
    }
  }
});

test("replies: reading a remote branch counts its real floor only while expanded", async t => {
  const page = await openFixture(t, { route: "/t/client/42", random: 0, mockWrites: { "/topics/timings": {} } });
  await page.evaluate(() => Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }));
  await reply(page, "/t/42.json", thread(42, 1, false));
  await branch(page).locator(":scope > summary").click();
  await reply(page, "/posts/422/replies.json", [{ ...post(8), cooked: `<p>${"真实回复的内容。".repeat(100)}</p>` }]);
  await page.setViewportSize({ width: 900, height: 480 });
  await branch(page).locator(".cx-branch-cooked").evaluate(el => {
    const scroller = el.closest(".cx-view-detail");
    scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  });
  await page.evaluate(() => Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }));
  await settle(page, 1200);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const before = await page.evaluate(() => __harness.requests.filter(r => r.url === "/topics/timings").map(r => r.body));
  assert.ok(before.some(body => new URLSearchParams(body).has("timings[8]")));
  await branch(page).evaluate(el => { el.open = false; });
  await settle(page, 1200);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const after = await page.evaluate(count => __harness.requests.filter(r => r.url === "/topics/timings").slice(count).map(r => r.body), before.length);
  assert.equal(after.some(body => new URLSearchParams(body).has("timings[8]")), false);
});

test("replies: the same floor in branch and timeline accrues reading time once", async t => {
  const page = await openFixture(t, { route: "/t/client/42", random: 0, width: 1600, mockWrites: { "/topics/timings": {} } });
  await page.evaluate(() => Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }));
  await reply(page, "/t/42.json", thread(42, 1));
  await branch(page).locator(":scope > summary").click();
  await page.evaluate(() => Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }));
  await settle(page, 1200);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const bodies = await page.evaluate(() => __harness.requests.filter(r => r.url === "/topics/timings").map(r => r.body));
  assert.ok(bodies.length);
  for (const body of bodies) {
    const params = new URLSearchParams(body);
    assert.ok(Number(params.get("timings[3]")) > 0);
    assert.ok(Number(params.get("timings[3]")) <= Number(params.get("topic_time")), "duplicate views must not double-count one floor");
  }
});
