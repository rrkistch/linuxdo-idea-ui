const { test, assert, openFixture, reply, hasText, navigate, settle, requestCount, waitRequest } = require("./browser-harness.cjs");

const posts = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => {
  const n = first + i;
  return { id: 4200 + n, topic_id: 42, post_number: n, username: `reader${n}`,
    cooked: `<p>楼层 ${n} 的正文。</p><p>阅读位置应保持稳定，异步更新不能打断当前阅读。</p><p><a href="/t/client/42/25">查看第 25 楼</a></p>` };
});
const thread = (first = 1, last = 20, total = 60) => ({ id: 42, title: "稳定阅读", slug: "client", posts_count: total,
  post_stream: { posts: posts(first, last), stream: Array.from({ length: total }, (_, i) => 4201 + i) } });
const pageUrl = (first, last) => `/t/42/posts.json?${posts(first, last).map(p => `post_ids[]=${p.id}`).join("&")}`;
const floor = (page, n) => page.locator(`.cx-thread-posts > [data-post-number="${n}"]`);
async function openThread(t, data = thread(), options = {}) {
  const page = await openFixture(t, { route: "/t/client/42", random: 0, width: 1280, ...options });
  await reply(page, "/t/42.json", data);
  await hasText(page, ".cx-thread-posts", `楼层 ${data.post_stream.posts[0].post_number} 的正文`);
  return page;
}
async function readFloor(page, n) {
  await floor(page, n).evaluate(el => {
    const scroller = el.closest(".cx-view-detail");
    scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 32;
  });
  await settle(page);
}
async function offset(page, n) {
  return floor(page, n).evaluate(el => el.getBoundingClientRect().top - el.closest(".cx-view-detail").getBoundingClientRect().top);
}
async function assertPosition(page, n, before) {
  await settle(page);
  assert.ok(Math.abs(await offset(page, n) - before) <= 2, `floor ${n} stays at the same reading position`);
}

test("scroll: passive native floor URL updates preserve rendered posts and scroll position", async t => {
  const data = thread();
  data.post_stream.posts[4].reply_count = 1;
  const page = await openThread(t, data);
  const branch = page.locator('.cx-reply-branch[data-parent-post="4205"]');
  await branch.locator(":scope > summary").click();
  await waitRequest(page, "/posts/4205/replies.json");
  await readFloor(page, 10);
  const before = await offset(page, 10);
  await floor(page, 10).evaluate(el => { window.originalFloor = el; });
  for (const n of [2, 15, 19]) {
    await page.evaluate(n => history.replaceState({}, "", `/t/client/42/${n}`), n);
    await page.evaluate(() => document.querySelector("#main-outlet").append(document.createElement("div")));
    await settle(page);
  }
  assert.equal(await requestCount(page, "/t/42.json"), 1, "native read-position updates are not a new topic navigation");
  assert.equal(await floor(page, 10).evaluate(el => el === window.originalFloor), true);
  await assertPosition(page, 10, before);
  await reply(page, "/posts/4205/replies.json", [{ ...posts(30, 30)[0], reply_to_post_number: 5 }]);
  await hasText(page, '.cx-reply-branch[data-parent-post="4205"]', "楼层 30 的正文");
  assert.equal(await branch.evaluate(el => el.open), true, "floor URL updates preserve pending branch ownership");
  await assertPosition(page, 10, before);
});

test("scroll: passive URL replacement during topic loading does not discard the response", async t => {
  const page = await openFixture(t, { route: "/t/client/42" });
  await waitRequest(page, "/t/42.json");
  await page.evaluate(() => history.replaceState({}, "", "/t/client/42/12"));
  await settle(page);
  assert.equal(await requestCount(page, "/t/42.json"), 1);
  await reply(page, "/t/42.json", thread());
  await hasText(page, ".cx-thread-posts", "楼层 1 的正文");
  assert.equal(await page.locator(".cx-view-detail").evaluate(el => el.scrollTop), 0);
});

test("scroll: prepending older posts preserves the current anchor with and without browser anchoring", async t => {
  for (const anchoring of ["auto", "none"]) {
    const page = await openThread(t, thread(21, 40));
    await page.locator(".cx-view-detail").evaluate((el, anchoring) => {
      el.style.overflowAnchor = anchoring;
      el.scrollTop = 10;
      el.dispatchEvent(new Event("scroll"));
    }, anchoring);
    await waitRequest(page, pageUrl(1, 20));
    // The reader moves on while the older page is still in flight.
    await readFloor(page, 25);
    const before = await offset(page, 25);
    await reply(page, pageUrl(1, 20), { post_stream: { posts: posts(1, 20) } });
    await hasText(page, ".cx-thread-posts", "楼层 1 的正文");
    await assertPosition(page, 25, before);
    assert.equal(await page.locator('.cx-thread-posts > [data-post-number]').count(), 40);
  }
});

test("scroll: a delayed newer page cannot pull a reader back to the bottom", async t => {
  const page = await openThread(t);
  await page.locator(".cx-view-detail").evaluate(el => { el.scrollTop = el.scrollHeight; });
  await waitRequest(page, pageUrl(21, 40));
  await readFloor(page, 10);
  const before = await offset(page, 10);
  await reply(page, pageUrl(21, 40), { post_stream: { posts: posts(21, 40) } });
  await hasText(page, ".cx-thread-posts", "楼层 40 的正文");
  await assertPosition(page, 10, before);
});

test("scroll: reply refresh appends new floors without moving a reader or duplicating turns", async t => {
  const page = await openThread(t, thread(1, 12, 12), { mockWrites: { "/posts.json": { id: 4213 } } });
  await readFloor(page, 5);
  await page.locator(".cx-md-edit").fill("mock 回复");
  await page.locator(".codex-composer-send").click();
  await waitRequest(page, "/t/42.json", 2);
  const before = await offset(page, 5);
  await reply(page, "/t/42.json", thread(1, 13, 13));
  await hasText(page, ".cx-thread-posts", "楼层 13 的正文");
  await assertPosition(page, 5, before);
  assert.equal(await page.locator('.cx-thread-posts > [data-post-number]').count(), 13);
});

test("scroll: reply refresh keeps loaded pages, disclosure state and the reader's latest position", async t => {
  const page = await openThread(t, thread(), { mockWrites: { "/posts.json": { id: 4261 } } });
  await page.locator(".cx-view-detail").evaluate(el => { el.scrollTop = el.scrollHeight; });
  await reply(page, pageUrl(21, 40), { post_stream: { posts: posts(21, 40) } });
  await readFloor(page, 25);
  await floor(page, 25).locator(".cx-think > summary").click();
  await page.locator(".cx-md-edit").fill("仅在 mock 中发送的回复");
  await page.locator(".codex-composer-send").click();
  await waitRequest(page, "/t/42.json", 2);
  await readFloor(page, 28);
  const before = await offset(page, 28);
  await reply(page, "/t/42.json", thread(1, 20, 61));
  await settle(page);
  assert.equal(await floor(page, 28).count(), 1, "refresh does not replace already loaded pages with the first page");
  await assertPosition(page, 28, before);
  assert.equal(await floor(page, 25).locator(".cx-think").evaluate(el => el.open), true);
  await page.locator(".cx-view-detail").evaluate(el => { el.scrollTop = el.scrollHeight; });
  await waitRequest(page, pageUrl(41, 60));
});

test("scroll: reply refresh from a previous visit cannot replace the reopened topic", async t => {
  const page = await openThread(t, thread(), { mockWrites: { "/posts.json": { id: 4261 } } });
  await page.locator(".cx-md-edit").fill("测试回复");
  await page.locator(".codex-composer-send").click();
  await waitRequest(page, "/t/42.json", 2);
  await navigate(page, "/search");
  await page.locator(".cx-search-input").waitFor();
  await navigate(page, "/t/client/42");
  await waitRequest(page, "/t/42.json", 3);
  await reply(page, "/t/42.json", thread(1, 20, 62));
  await readFloor(page, 10);
  const before = await offset(page, 10);
  const stale = thread();
  stale.post_stream.posts[0].cooked = "<p>不应出现的过期刷新</p>";
  await reply(page, "/t/42.json", stale);
  await settle(page);
  assert.doesNotMatch(await page.locator(".cx-thread-posts").innerText(), /不应出现的过期刷新/);
  await assertPosition(page, 10, before);
});

test("scroll: explicit floor navigation and browser history still locate the requested floor", async t => {
  const page = await openThread(t, thread(1, 30, 30));
  await navigate(page, "/t/client/42/25");
  await reply(page, "/t/42.json", thread(1, 30, 30));
  await floor(page, 25).locator(":scope.cx-jump-highlight").waitFor();
  await settle(page, 600);
  assert.ok(await offset(page, 25) >= 0);
  await page.goBack();
  await reply(page, "/t/42.json", thread(1, 30, 30));
  await settle(page);
  assert.equal(await page.locator(".cx-view-detail").evaluate(el => el.scrollTop), 0);
  await page.goForward();
  await reply(page, "/t/42.json", thread(1, 30, 30));
  await floor(page, 25).locator(":scope.cx-jump-highlight").waitFor();
});

test("scroll: a delayed explicit floor lookup yields when the reader scrolls elsewhere", async t => {
  const page = await openThread(t);
  await floor(page, 2).locator('a[href="/t/client/42/25"]').click();
  await reply(page, "/t/42.json", thread());
  await waitRequest(page, "/t/42/25.json");
  await readFloor(page, 10);
  const before = await offset(page, 10);
  await reply(page, "/t/42/25.json", thread(21, 40));
  await hasText(page, ".cx-thread-posts", "楼层 25 的正文");
  await assertPosition(page, 10, before);
});
