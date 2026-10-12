const { test, assert, openFixture, topic, list, reply, navigate, hasText, waitRequest, settle } = require('./browser-harness.cjs');

const data = id => { const value = topic(`Topic ${id}`, id); value.post_stream.posts.push({id:id*10+2, post_number:2, username:'peer', cooked:'<p>Second floor</p>'}); return value; };
async function open(t, options = {}) {
  const page = await openFixture(t, {route:'/t/topic/42', username:'tester', ...options});
  await reply(page, '/t/42.json', data(42));
  await hasText(page, '.cx-thread-posts', 'Second floor');
  return page;
}
async function nativeEditor(page) {
  await page.evaluate(() => {
    const composer = { open(options) {
      __harness.nativeTarget = options;
      const el = document.createElement('div'); el.id='reply-control'; el.className='open';
      el.innerHTML='<textarea></textarea><div class="save-or-cancel"><button class="create btn-primary">Publish</button></div>';
      el.querySelector('button').onclick = () => { __harness.nativeSends = (__harness.nativeSends || 0) + 1; };
      document.body.append(el);
    }};
    window.Discourse = { __container__: { lookup(name) { return name === 'service:composer' ? composer : name === 'controller:topic' ? {model:{id:42}} : null; } } };
  });
}

test('composer owner: list after a topic transfers a new draft, never posts to the previous topic', async t => {
  const page = await open(t, { mockWrites:{'/posts.json':{id:999}} });
  await nativeEditor(page);
  await navigate(page, '/new');
  await reply(page, '/new.json', list('List'));
  await page.locator('.cx-md-edit').fill('A new topic draft');
  await page.locator('.codex-composer-send').click();
  await hasText(page, '.cx-composer-status', '原生');
  assert.equal(await page.evaluate(() => __harness.requests.filter(r=>r.url==='/posts.json').length), 0);
  assert.equal(await page.locator('#reply-control textarea').inputValue(), 'A new topic draft');
  assert.equal(await page.evaluate(() => __harness.nativeSends || 0), 0);
  await hasText(page, '.cx-md-edit', 'A new topic draft');
});

test('composer owner: drafts and reply targets survive routes and reload, and are account scoped', async t => {
  const page = await open(t);
  await page.locator('.cx-md-edit').fill('Draft for A');
  await page.locator('.cx-act[data-action="reply"][data-post-number="2"]').click();
  await navigate(page, '/t/topic/43'); await reply(page, '/t/43.json', data(43));
  assert.equal(await page.locator('.cx-md-edit').innerText(), '');
  await page.locator('.cx-md-edit').fill('Draft for B');
  await navigate(page, '/t/topic/42'); await reply(page, '/t/42.json', data(42));
  await hasText(page, '.cx-md-edit', 'Draft for A');
  await hasText(page, '.cx-compose-target', '#2');
  await page.reload(); await reply(page, '/t/42.json', data(42));
  await hasText(page, '.cx-md-edit', 'Draft for A');
  await page.evaluate(() => { const a=document.querySelector('#current-user a'); a.href='/u/another'; a.textContent='another'; document.querySelector('#main-outlet').append('account switch'); });
  await settle(page);
  assert.equal(await page.locator('.cx-md-edit').innerText(), '');
});

test('composer owner: pending success clears only the sent draft, not a new topic draft', async t => {
  const page = await open(t, {mockWrites:{'/posts.json':{}}, manualWrites:['/posts.json']});
  await page.locator('.cx-md-edit').fill('Send from A');
  await page.locator('.codex-composer-send').click();
  await waitRequest(page, '/posts.json');
  await navigate(page, '/t/topic/43'); await reply(page, '/t/43.json', data(43));
  await page.locator('.cx-md-edit').fill('Keep B intact');
  await reply(page, '/posts.json', {id:425, topic_id:42});
  await settle(page);
  await hasText(page, '.cx-md-edit', 'Keep B intact');
  assert.doesNotMatch(await page.locator('.cx-composer-status').innerText(), /已发送/);
  await navigate(page, '/t/topic/42'); await reply(page, '/t/42.json', data(42));
  assert.equal(await page.locator('.cx-md-edit').innerText(), '');
});

test('composer owner: failure retains text without opening or submitting the native editor automatically', async t => {
  const page = await open(t, {mockWrites:{'/posts.json':{}}, manualWrites:['/posts.json']});
  await nativeEditor(page);
  await page.locator('.cx-md-edit').fill('Keep this after failure');
  await page.locator('.codex-composer-send').click();
  await reply(page, '/posts.json', {errors:['Request result unknown']}, 503);
  await hasText(page, '.cx-composer-status', '失败');
  await hasText(page, '.cx-md-edit', 'Keep this after failure');
  assert.equal(await page.locator('#reply-control').count(), 0);
  await page.getByRole('button', {name:'打开原生编辑器'}).click();
  assert.equal(await page.locator('#reply-control textarea').inputValue(), 'Keep this after failure');
  assert.equal(await page.evaluate(() => __harness.nativeSends || 0), 0);
  assert.doesNotMatch(await page.locator('.cx-composer-status').innerText(), /已发送/);
});

test('composer owner: late upload appends to its original draft only', async t => {
  const page = await open(t, {mockWrites:{'/uploads.json':{}}, manualWrites:['/uploads.json']});
  await page.locator('.cx-md-edit').fill('A attachment');
  await page.locator('.cx-composer-file').setInputFiles({name:'sample.png', mimeType:'image/png', buffer:Buffer.from('mock')});
  await waitRequest(page, '/uploads.json');
  await navigate(page, '/t/topic/43'); await reply(page, '/t/43.json', data(43));
  await page.locator('.cx-md-edit').fill('B stays unchanged');
  await reply(page, '/uploads.json', {id:1, url:'data:image/png;base64,iVBORw0KGgo=', short_url:'upload://sample', original_filename:'sample.png'});
  await settle(page);
  assert.equal(await page.locator('.cx-md-edit').innerText(), 'B stays unchanged');
  await navigate(page, '/t/topic/42'); await reply(page, '/t/42.json', data(42));
  await hasText(page, '.cx-md-edit', 'upload://sample');
  await hasText(page, '.cx-md-edit', 'A attachment');
});

test('composer owner: editing during submission preserves newer text and topic loading cannot send to an old target', async t => {
  const page=await open(t,{mockWrites:{'/posts.json':{}},manualWrites:['/posts.json']});
  const input=page.locator('.cx-md-edit');
  await input.fill('Original submission'); await page.locator('.codex-composer-send').click();
  await waitRequest(page,'/posts.json');
  await input.fill('New text typed while waiting');
  await reply(page,'/posts.json',{id:425,topic_id:42});
  await hasText(page,'.cx-composer-status','已发送');
  await hasText(page,'.cx-md-edit','New text typed while waiting');
  await navigate(page,'/t/topic/43'); await waitRequest(page,'/t/43.json');
  await input.fill('For topic B');
  assert.equal(await page.locator('.codex-composer-send').isDisabled(),true);
  await input.dispatchEvent('keydown',{key:'Enter'});
  assert.equal(await page.evaluate(()=>__harness.requests.filter(r=>r.url==='/posts.json').length),1);
  await reply(page,'/t/43.json',data(43));
  assert.equal(await page.locator('.codex-composer-send').isDisabled(),false);
});
