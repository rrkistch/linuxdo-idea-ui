const {test, assert, openFixture, topic, reply, hasText, requestCount, waitRequest, navigate, settle} = require('./browser-harness.cjs');
const quote = (attrs, title = 'Original author') => '<aside class="quote" '+attrs+'><div class="title">'+title+'</div><blockquote><p>Quoted original text.</p></blockquote></aside>';
async function openQuoted(t, html) {
  const page=await openFixture(t,{route:'/t/current/42',random:0});
  const data=topic('Current topic',42);
  data.post_stream.posts[0].cooked=html+'<p>Current commentary.</p>';
  data.post_stream.posts.push({id:422,post_number:2,username:'peer',cooked:'<p>Current floor two.</p>'});
  data.post_stream.stream=[420,422]; data.posts_count=2;
  await reply(page,'/t/42.json',data);
  await hasText(page,'.cx-thread-posts','Current commentary.');
  return page;
}
test('quotes: cross-topic metadata opens source topic and floor with keyboard and normal link semantics',async t=>{
  const page=await openQuoted(t,quote('data-topic="90" data-post="1"'));
  const link=page.locator('.cx-jump-src');
  assert.equal(await link.getAttribute('href'),'/t/topic/90/1');
  const before=await page.locator('.cx-tool-card').getAttribute('class');
  const intercepted=await link.evaluate(el=>{
    let prevented;
    document.addEventListener('click',e=>{prevented=e.defaultPrevented; e.preventDefault();},{once:true});
    el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true}));
    return prevented;
  });
  assert.equal(intercepted,false);
  assert.equal(await page.locator('.cx-tool-card').getAttribute('class'),before);
  await link.focus(); await page.keyboard.press('Enter');
  await reply(page,'/t/90.json',topic('Source topic',90));
  await page.locator('.cx-thread-posts > [data-post-number="1"].cx-jump-highlight').waitFor();
  assert.equal(new URL(page.url()).pathname,'/t/topic/90/1');
  assert.equal(await requestCount(page,'/t/42/1.json'),0);
  await hasText(page,'.cx-thread-posts','Source topic body');
  await page.goBack(); await reply(page,'/t/42.json',topic('Current topic',42));
  await hasText(page,'.cx-thread-posts','Current topic body');
});
test('quotes: title links supply missing metadata and load remote floors in the destination topic',async t=>{
  const page=await openQuoted(t,quote('data-post="8"','<a href="/t/original/90/8">Original topic</a>'));
  assert.equal(await page.locator('.cx-jump-src').getAttribute('href'),'/t/original/90/8');
  await page.locator('.cx-jump-src').click();
  await reply(page,'/t/90.json',topic('Source topic',90));
  await waitRequest(page,'/t/90/8.json');
  await reply(page,'/t/90/8.json',{id:90,post_stream:{posts:[{id:908,post_number:8,username:'source',cooked:'<p>Matched source floor eight.</p>'}],stream:[900,908]}});
  await page.locator('.cx-thread-posts > [data-post-number="8"].cx-jump-highlight').waitFor();
  await hasText(page,'.cx-thread-posts','Matched source floor eight.');
  assert.equal(await requestCount(page,'/t/42/8.json'),0);
});
test('quotes: same-topic and legacy floor-only quotes retain local positioning and return',async t=>{
  const page=await openQuoted(t,quote('data-topic="42" data-post="2"')+quote('data-post="1"'));
  await page.locator('.cx-jump-src').first().click();
  await page.locator('.cx-thread-posts > [data-post-number="2"].cx-jump-highlight').waitFor();
  assert.equal(new URL(page.url()).pathname,'/t/current/42');
  assert.equal(await requestCount(page,'/t/42.json'),1);
  assert.equal(await page.locator('.cx-jump-back').isVisible(),true);
  await page.locator('.cx-jump-src').last().click();
  await page.locator('.cx-thread-posts > [data-post-number="1"].cx-jump-highlight').waitFor();
});
test('quotes: invalid explicit metadata does not fall back to the current topic',async t=>{
  const page=await openQuoted(t,quote('data-topic="bad" data-post="1"')+quote('data-topic="90" data-post="-1"'));
  assert.equal(await page.locator('.cx-jump-src').count(),0);
  assert.equal(await page.locator('.cx-tool-card-body').count(),2);
  await page.locator('.cx-tool-card-head').first().click();
  await hasText(page,'.cx-tool-card-body','Quoted original text.');
});
test('quotes: failed destinations remain retryable and late responses cannot replace another route',async t=>{
  const page=await openQuoted(t,quote('data-topic="90" data-post="1"'));
  await page.locator('.cx-jump-src').click();
  await reply(page,'/t/90.json',{},403);
  await hasText(page,'.cx-thread-posts','HTTP 403');
  await page.locator('.cx-btn-topic-retry').click();
  await waitRequest(page,'/t/90.json',2);
  await navigate(page,'/t/third/100'); await reply(page,'/t/100.json',topic('Third topic',100));
  await reply(page,'/t/90.json',topic('Late source',90)); await settle(page);
  await hasText(page,'.cx-thread-posts','Third topic body');
  assert.doesNotMatch(await page.locator('.cx-thread-posts').innerText(),/Late source/);
});
