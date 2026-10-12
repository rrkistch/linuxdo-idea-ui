const { test, assert, openFixture, list, reply, waitRequest, requestCount, hasText, settle, navigate, assertNative } = require('./browser-harness.cjs');

test('list errors: homepage shares latest data with rail and uses same-origin AJAX headers', async t => {
  const page = await openFixture(t, { route: '/' });
  await reply(page, '/latest.json', list('One request for both views'));
  await hasText(page, '.cx-thread-rows', 'One request for both views');
  assert.equal(await requestCount(page, '/latest.json'), 1);
  const request = await page.evaluate(() => __harness.requests.find(r => r.url === '/latest.json'));
  assert.equal(request.headers['x-requested-with'], 'XMLHttpRequest');
  assert.equal(request.credentials, 'same-origin');
  await hasText(page, '.codex-rail', 'One request for both views');
});

test('list errors: an unknown 403 does not claim logout or retry on DOM mutations after cooldown', async t => {
  const page = await openFixture(t);
  await reply(page, '/new.json', {}, 403);
  await hasText(page, '.cx-thread-rows', 'HTTP 403');
  assert.doesNotMatch(await page.locator('.cx-thread-rows').innerText(), /未登录|登录后重试/);
  await page.evaluate(() => {
    const now = Date.now.bind(Date);
    Date.now = () => now() + 10000;
    document.getElementById('main-outlet').append('Native render');
  });
  await settle(page);
  assert.equal(await requestCount(page, '/new.json'), 1);
  await page.locator('.cx-btn-retry').click();
  await reply(page, '/new.json', list('Manual retry succeeds'));
  await hasText(page, '.cx-thread-rows', 'Manual retry succeeds');
});

for (const status of [403, 200]) {
  test(`list errors: a challenge response (${status}) offers native verification without rendering HTML or retrying`, async t => {
    const page = await openFixture(t);
    await reply(page, '/new.json', '<html><script>window.challengeExecuted=true</script><h1>Just a moment...</h1></html>', status, -1,
      { 'Content-Type': 'text/html', 'cf-mitigated': 'challenge' });
    await hasText(page, '.cx-thread-rows', '浏览器验证');
    assert.equal(await page.locator('.cx-thread-rows script').count(), 0);
    assert.equal(await page.evaluate(() => window.challengeExecuted), undefined);
    const native = page.locator('.cx-list-native');
    const url = new URL(await native.getAttribute('href'), page.url());
    assert.equal(url.pathname, '/new');
    assert.equal(url.searchParams.get('cx_native'), '1');
    assert.equal(await requestCount(page, '/new.json'), 1);
  });
}

test('list errors: explicit login and permission failures retain the server reason as safe text', async t => {
  const page = await openFixture(t);
  await reply(page, '/new.json', { error_type: 'not_logged_in', errors: ['请登录后访问'] }, 403);
  await hasText(page, '.cx-thread-rows', '请登录后访问');
  await navigate(page, '/c/private/9');
  await reply(page, '/c/private/9.json', { error_type: 'invalid_access', errors: ['没有访问权限 <img src=x onerror=alert(1)>'] }, 403);
  await hasText(page, '.cx-thread-rows', '没有访问权限');
  assert.equal(await page.locator('.cx-thread-rows img').count(), 0);
  assert.doesNotMatch(await page.locator('.cx-thread-rows').innerText(), /未登录/);
});

test('list errors: retry remains deduplicated and late errors cannot revive a departed theme', async t => {
  const page = await openFixture(t);
  await reply(page, '/new.json', {}, 403);
  await page.locator('.cx-btn-retry').click();
  await waitRequest(page, '/new.json', 2);
  await page.evaluate(() => document.getElementById('main-outlet').append('Native render'));
  await settle(page);
  assert.equal(await requestCount(page, '/new.json'), 2);
  await navigate(page, '/new?cx_native=1');
  await reply(page, '/new.json', {}, 403);
  await settle(page);
  await assertNative(page);
});

test('list errors: valid JSON remains compatible with an inaccurate HTML content type', async t => {
  const page = await openFixture(t);
  await reply(page, '/new.json', list('Valid list with wrong header'), 200, -1, { 'Content-Type': 'text/html' });
  await hasText(page, '.cx-thread-rows', 'Valid list with wrong header');
});
