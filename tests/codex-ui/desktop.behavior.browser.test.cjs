const {test, assert, openFixture, topic, list, reply, waitRequest, requestCount, hasText, settle, navigate, assertNative} = require('./browser-harness.cjs');

function thread(read = 0) {
  const data=topic('Resume thread',42);
  data.post_stream.posts=Array.from({length:20},(_,i)=>({id:420+i+1,post_number:i+1,username:`dev${i+1}`,cooked:`<p>Floor ${i+1} ${'Content for reading. '.repeat(30)}</p>`}));
  data.post_stream.stream=data.post_stream.posts.map(p=>p.id); data.posts_count=20; data.last_read_post_number=read; data.highest_post_number=20;
  return data;
}
test('desktop: GET timeout is retryable, cancellation remains silent and late responses cannot render', async t=>{
  const page=await openFixture(t,{clock:true});
  await waitRequest(page,'/new.json');
  await page.clock.runFor(20050);
  await hasText(page,'.cx-thread-rows','超时');
  await page.locator('.cx-btn-retry').click();
  await reply(page,'/new.json',list('Retry'),200,-1);
  await hasText(page,'.cx-thread-rows','Retry');
  await reply(page,'/new.json',list('Old response'),200,0);
  await navigate(page,'/top'); await waitRequest(page,'/top.json');
  await navigate(page,'/new?cx_native=1');
  await page.clock.runFor(21000);
  await assertNative(page);
});
test('desktop: topic resume prefers explicit floor, then session anchor, then server unread',async t=>{
  const page=await openFixture(t,{route:'/t/topic/42'});
  await reply(page,'/t/42.json',thread(8));
  await page.locator('[data-post-number="9"].cx-jump-highlight').waitFor();
  const turn=page.locator('.cx-turn-agent[data-post-number="14"]');
  await turn.evaluate(el=>el.scrollIntoView({block:'start'})); await settle(page);
  const before=await turn.evaluate(el=>el.getBoundingClientRect().top);
  await navigate(page,'/new'); await reply(page,'/new.json',list('List'));
  await navigate(page,'/t/topic/42'); await reply(page,'/t/42.json',thread(1));
  await settle(page,400);
  assert.ok(Math.abs(await turn.evaluate(el=>el.getBoundingClientRect().top)-before)<3);
  await navigate(page,'/new'); await reply(page,'/new.json',list('List'));
  await navigate(page,'/t/topic/42/4'); await reply(page,'/t/42.json',thread(8));
  await page.locator('[data-post-number="4"].cx-jump-highlight').waitFor();
});
test('desktop: lazy resume yields to scrolling while its remote floor loads',async t=>{
  const page=await openFixture(t,{route:'/t/topic/42'});
  const data=thread(40); data.highest_post_number=80;
  await reply(page,'/t/42.json',data);
  await waitRequest(page,'/t/42/41.json');
  await page.locator('.cx-turn-agent[data-post-number="6"]').evaluate(el=>el.scrollIntoView({block:'start'}));
  const before=await page.locator('.cx-view-detail').evaluate(el=>el.scrollTop);
  await reply(page,'/t/42/41.json',{posts_count:80,post_stream:{posts:[{id:461,post_number:41,username:'dev41',cooked:'<p>Remote unread</p>'}],stream:Array.from({length:80},(_,i)=>421+i)}});
  await settle(page,350);
  assert.ok(Math.abs(await page.locator('.cx-view-detail').evaluate(el=>el.scrollTop)-before)<3);
  assert.equal(await page.locator('[data-post-number="41"].cx-jump-highlight').count(),0);
});
test('desktop: profile hover waits 150ms, uses a 30s cache, and closes on scroll or resize',async t=>{
  const page=await openFixture(t,{route:'/t/topic/42',clock:true});
  await reply(page,'/t/42.json',thread());
  const author=page.locator('.cx-worked [data-cx-user="dev2"]');
  await author.dispatchEvent('mouseover');
  await page.clock.runFor(100);
  assert.equal(await requestCount(page,'/u/dev2.json'),0);
  await page.clock.runFor(60);
  await reply(page,'/u/dev2.json',{user:{username:'dev2',name:'Cached user'}});
  await hasText(page,'.cx-user-card','Cached user');
  await page.locator('.cx-view-detail').dispatchEvent('scroll');
  assert.equal(await page.locator('.cx-user-card').count(),0);
  await author.focus(); await hasText(page,'.cx-user-card','Cached user');
  assert.equal(await requestCount(page,'/u/dev2.json'),1);
  await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
  assert.equal(await page.locator('.cx-user-card').count(),0);
  await page.clock.runFor(31000); await author.dispatchEvent('click',{button:0});
  await waitRequest(page,'/u/dev2.json',2);
});
test('desktop: project switch updates coherent collapsed activity without moving the reader',async t=>{
  const page=await openFixture(t,{route:'/t/topic/42',random:0});
  await reply(page,'/t/42.json',thread());
  const target=page.locator('.cx-turn-agent[data-post-number="5"] .cx-cooked');
  await target.evaluate(el=>el.scrollIntoView({block:'start'}));
  const before=await target.evaluate(el=>el.getBoundingClientRect().top);
  await page.locator('[data-workspace-menu]').click(); await page.locator('[data-project-id="task-pipeline"]').click();
  await hasText(page,'.cx-turn-activity','task-pipeline');
  assert.doesNotMatch(await page.locator('.cx-turn-activity').first().textContent(),/request-client|Codey Fastctx/);
  assert.equal(await page.locator('.cx-turn-activity > details').first().getAttribute('open'),null);
  assert.ok(Math.abs(await target.evaluate(el=>el.getBoundingClientRect().top)-before)<3);
});
