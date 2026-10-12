const { test, assert, openFixture, topic, reply, requestCount, waitRequest, navigate, scrollList, settle, hasText, assertNative } = require('./browser-harness.cjs');

const batch = (start, count, more = null) => ({ topic_list: {
  topics: Array.from({ length: count }, (_, i) => ({ id: start + i, title: `Topic ${start + i}`, slug: `topic-${start + i}`,
    posts_count: 3, created_at: '2026-09-01T00:00:00Z', bumped_at: '2026-09-02T00:00:00Z' })),
  more_topics_url: more
} });
const ids = page => page.locator('.cx-thread-rows .cx-trow').evaluateAll(rows => rows.map(row => Number(row.dataset.topicId)));

test('list: returning from topic restores 60 rows, source URL, position and pagination', async t => {
  const page = await openFixture(t, { route: '/new', width: 1280 });
  await page.setViewportSize({ width: 1280, height: 600 });
  await reply(page, '/new.json', batch(1, 30, '/new?page=1'));
  await scrollList(page);
  await reply(page, '/new?page=1', batch(31, 30, '/new?page=2'));
  const row = page.locator('.cx-trow[data-topic-id="55"]');
  await row.scrollIntoViewIfNeeded();
  const top = await row.evaluate(el => el.getBoundingClientRect().top);
  await row.click();
  const data = { ...topic('Topic 55', 55), category_id: 9 };
  await reply(page, '/t/55.json', data);
  await page.goBack();
  await row.waitFor({ state: 'visible' });
  await settle(page);
  assert.equal((await ids(page)).length, 60);
  assert.ok(Math.abs(await row.evaluate(el => el.getBoundingClientRect().top) - top) < 2);
  assert.equal(await requestCount(page, '/new.json'), 1);
  await page.goForward();
  await reply(page, '/t/55.json', data);
  await hasText(page, '.cx-thread-posts', 'Topic 55 body');
  await page.locator('.cx-back-btn').click();
  await row.waitFor({ state: 'visible' });
  assert.equal(new URL(page.url()).pathname, '/new');
  assert.equal((await ids(page)).length, 60);
  await scrollList(page);
  await reply(page, '/new?page=2', batch(61, 30));
  assert.deepEqual(await ids(page), Array.from({ length: 90 }, (_, i) => i + 1));
});

test('list: route query changes request a different list and history restores each snapshot', async t => {
  const page = await openFixture(t, { route: '/latest?order=created&ascending=false' });
  await reply(page, '/latest.json?order=created&ascending=false', batch(20, 3));
  await navigate(page, '/latest?order=views&ascending=true');
  await reply(page, '/latest.json?order=views&ascending=true', batch(40, 2));
  assert.deepEqual(await ids(page), [40, 41]);
  await page.goBack();
  await hasText(page, '.cx-thread-rows', 'Topic 20');
  assert.deepEqual(await ids(page), [20, 21, 22]);
  assert.equal(await requestCount(page, '/latest.json?order=created&ascending=false'), 1);
  await page.locator('.cx-trow[data-topic-id="21"]').click();
  await reply(page, '/t/21.json', topic('Topic 21', 21));
  await page.locator('.cx-back-btn').click();
  await hasText(page, '.cx-thread-rows', 'Topic 20');
  assert.equal(new URL(page.url()).search, '?order=created&ascending=false');
});

test('list: native routes preserve category/tag paths, periods and distinct unread endpoints', async t => {
  const cases = [
    ['/', '/latest.json'], ['/unread', '/unread.json'], ['/unseen', '/unseen.json'],
    ['/top?period=weekly', '/top.json?period=weekly'], ['/top/monthly', '/top.json?period=monthly'],
    ['/c/dev/tools/9/l/latest?order=created&ascending=false', '/c/dev/tools/9/l/latest.json?order=created&ascending=false'],
    ['/c/9?order=views', '/c/9.json?order=views'],
    ['/tag/1461-tag/1461?order=created&page=2', '/tag/1461-tag/1461.json?order=created&page=2'],
    ['/new?subset=replies', '/new.json?subset=replies']
  ];
  for (const [route, endpoint] of cases) {
    const page = await openFixture(t, { route });
    await reply(page, endpoint, batch(7, 2));
    assert.deepEqual(await ids(page), [7, 8], route);
  }
});

test('list: new subsets update URL and requests without native buttons, including history', async t => {
  const page = await openFixture(t, { route: '/new?order=created' });
  await reply(page, '/new.json?order=created', batch(1, 2));
  await page.locator('.cx-new-toggle-btn[data-mod="topics"]').click();
  await reply(page, '/new.json?order=created&subset=topics', batch(10, 2));
  assert.equal(new URL(page.url()).searchParams.get('subset'), 'topics');
  await page.locator('.cx-new-toggle-btn[data-mod="replies"]').click();
  await reply(page, '/new.json?order=created&subset=replies', batch(20, 2));
  assert.deepEqual(await ids(page), [20, 21]);
  await page.goBack();
  await hasText(page, '.cx-thread-rows', 'Topic 10');
  assert.equal(await page.locator('.cx-new-toggle-btn.active').getAttribute('data-mod'), 'topics');
  await page.locator('.cx-new-toggle-btn[data-mod="all"]').click();
  await reply(page, '/new.json?order=created', batch(1, 2));
  await hasText(page, '.cx-thread-rows', 'Topic 1');
  assert.equal(new URL(page.url()).searchParams.has('subset'), false);
});

test('list: deliberate list navigation fetches fresh data instead of reusing a history snapshot', async t => {
  const page = await openFixture(t);
  await reply(page, '/new.json', batch(1, 3));
  await navigate(page, '/top');
  await reply(page, '/top.json', batch(10, 3));
  await page.locator('.cx-filter-btn').click();
  await page.locator('.cx-fchip[data-filter-path="/new"]').click();
  await reply(page, '/new.json', batch(20, 3));
  await hasText(page, '.cx-thread-rows', 'Topic 20');
  assert.deepEqual(await ids(page), [20, 21, 22]);
  assert.equal(await requestCount(page, '/new.json'), 2);
});

test('list: append failures retain rows, retry explicitly and deduplicate within/across pages', async t => {
  const page = await openFixture(t);
  const first = batch(1, 3, '/new?page=1');
  first.topic_list.topics.push(first.topic_list.topics[1]);
  await reply(page, '/new.json', first);
  assert.deepEqual(await ids(page), [1, 2, 3]);
  await scrollList(page);
  await reply(page, '/new?page=1', {}, 503);
  await hasText(page, '.cx-list-status', '加载失败');
  assert.deepEqual(await ids(page), [1, 2, 3]);
  await scrollList(page);
  await settle(page);
  assert.equal(await requestCount(page, '/new?page=1'), 1);
  await page.locator('.cx-btn-more-retry').click();
  const next = batch(3, 3, '/new?page=1');
  next.topic_list.topics.push(next.topic_list.topics[1]);
  await reply(page, '/new?page=1', next);
  await hasText(page, '.cx-thread-rows', 'Topic 5');
  assert.deepEqual(await ids(page), [1, 2, 3, 4, 5]);
  await scrollList(page);
  await settle(page);
  assert.equal(await requestCount(page, '/new?page=1'), 2, 'repeated next-page URL must not loop');
});

test('list: query changes reject stale first/append responses and stale finally', async t => {
  const a = '/new.json?subset=topics', b = '/new.json?subset=replies';
  const page = await openFixture(t, { route: '/new?subset=topics' });
  await waitRequest(page, a);
  await navigate(page, '/new?subset=replies');
  await reply(page, b, batch(20, 3, '/new?subset=replies&page=1'));
  await reply(page, a, batch(1, 3));
  assert.deepEqual(await ids(page), [20, 21, 22]);
  await scrollList(page);
  await waitRequest(page, '/new?subset=replies&page=1');
  await navigate(page, '/new?subset=topics');
  await reply(page, a, batch(40, 3, '/new?subset=topics&page=1'));
  await scrollList(page);
  await waitRequest(page, '/new?subset=topics&page=1');
  await reply(page, '/new?subset=replies&page=1', batch(90, 3));
  await scrollList(page);
  assert.equal(await requestCount(page, '/new?subset=topics&page=1'), 1);
  await reply(page, '/new?subset=topics&page=1', batch(43, 3));
  assert.deepEqual(await ids(page), [40, 41, 42, 43, 44, 45]);
  await navigate(page, '/new?cx_native=1');
  await settle(page);
  await assertNative(page);
});

test('list: visible times, new and unread indicators follow server fields', async t => {
  const page = await openFixture(t);
  const data = batch(1, 4);
  Object.assign(data.topic_list.topics[0], { unseen: true });
  Object.assign(data.topic_list.topics[1], { unread_posts: 2, new_posts: 2, unread: 2, last_read_post_number: 1 });
  Object.assign(data.topic_list.topics[2], { unread_posts: 0, new_posts: 2, last_read_post_number: 3 });
  Object.assign(data.topic_list.topics[3], { bumped_at: null, last_posted_at: '2026-09-03T00:00:00Z' });
  await reply(page, '/new.json', data);
  assert.equal(await page.locator('[data-topic-id="1"] .cx-trow-dot.cx-unread').count(), 1);
  assert.match(await page.locator('[data-topic-id="1"] .cx-trow-dot').getAttribute('title'), /新话题/);
  assert.match(await page.locator('[data-topic-id="2"] .cx-trow-dot').getAttribute('title'), /2.*未读/);
  assert.equal(await page.locator('[data-topic-id="3"] .cx-trow-dot.cx-unread').count(), 0);
  assert.equal(await page.locator('.cx-trow.cx-read[data-topic-id="3"]').count(), 1);
  assert.equal(await page.locator('.cx-trow.cx-read[data-topic-id="4"]').count(), 0, 'missing user data is not evidence of reading');
  assert.notEqual(await page.locator('[data-topic-id="1"] .cx-trow-meta span').last().innerText(), '');
  assert.notEqual(await page.locator('[data-topic-id="4"] .cx-trow-meta span').last().innerText(), '');
});

test('list: category breadcrumb differs from return-to-source and tag history stays intact', async t => {
  const source = '/tag/1461-tag/1461?order=created&ascending=false';
  const endpoint = '/tag/1461-tag/1461.json?order=created&ascending=false';
  const page = await openFixture(t, { route: source });
  await page.evaluate(() => {
    window.Discourse = { URL: { routeTo(path) { history.pushState({ nativeMarker: 'keep' }, '', path); } } };
  });
  await reply(page, endpoint, batch(5, 3));
  await page.locator('.cx-trow[data-topic-id="6"]').click();
  await reply(page, '/t/6.json', { ...topic('Tagged topic', 6), category_id: 9 });
  await hasText(page, '.cx-thread-posts', 'Tagged topic body');
  assert.equal(await page.evaluate(() => history.state.nativeMarker), 'keep');
  await page.locator('.cx-crumb .cx-proj').click();
  await reply(page, '/c/9.json', batch(20, 3));
  assert.equal(new URL(page.url()).pathname, '/c/9');
  await page.goBack();
  await reply(page, '/t/6.json', { ...topic('Tagged topic', 6), category_id: 9 });
  await hasText(page, '.cx-thread-posts', 'Tagged topic body');
  await page.locator('.cx-back-btn').click();
  await hasText(page, '.cx-thread-rows', 'Topic 5');
  assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, source);
  assert.deepEqual(await ids(page), [5, 6, 7]);
  assert.equal(await requestCount(page, endpoint), 1);
});

test('list: cancelled append cannot overwrite a restored snapshot or unlock its newer append', async t => {
  const page = await openFixture(t);
  await reply(page, '/new.json', batch(1, 3, '/new?page=1'));
  await scrollList(page);
  await waitRequest(page, '/new?page=1');
  await navigate(page, '/t/topic/2');
  await reply(page, '/t/2.json', topic('Topic 2', 2));
  await page.goBack();
  await hasText(page, '.cx-thread-rows', 'Topic 1');
  await page.locator('.cx-view-list').waitFor({ state: 'visible' });
  await scrollList(page);
  await waitRequest(page, '/new?page=1', 2);
  await reply(page, '/new?page=1', batch(90, 3), 200, 0);
  await scrollList(page);
  assert.equal(await requestCount(page, '/new?page=1'), 2);
  await reply(page, '/new?page=1', batch(4, 3));
  await hasText(page, '.cx-thread-rows', 'Topic 6');
  assert.deepEqual(await ids(page), [1, 2, 3, 4, 5, 6]);
});

test('list: malformed pagination response is retryable, while native exit clears snapshots and late requests', async t => {
  const page = await openFixture(t);
  await reply(page, '/new.json', batch(1, 3, '/new?page=1'));
  await scrollList(page);
  await reply(page, '/new?page=1', { error: 'not a list' });
  await hasText(page, '.cx-list-status', '话题列表响应无效');
  assert.deepEqual(await ids(page), [1, 2, 3]);
  await page.locator('.cx-btn-more-retry').click();
  await waitRequest(page, '/new?page=1', 2);
  await navigate(page, '/new?cx_native=1');
  await reply(page, '/new?page=1', batch(90, 3));
  await settle(page);
  await assertNative(page);
  await page.evaluate(() => sessionStorage.removeItem('codex_native_mode'));
  await navigate(page, '/new');
  await reply(page, '/new.json', batch(20, 3));
  await hasText(page, '.cx-thread-rows', 'Topic 20');
  assert.deepEqual(await ids(page), [20, 21, 22]);
});
