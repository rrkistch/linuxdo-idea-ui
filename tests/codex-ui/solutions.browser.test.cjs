const {test, assert, openFixture, topic, reply, waitRequest, hasText, navigate, settle, assertNative} = require('./browser-harness.cjs');
const fs = require('node:fs');
const path = require('node:path');

function solvedTopic(count = 18) {
  const data = topic('推荐一款大米',42);
  data.has_accepted_answer = true;
  data.accepted_answers = Array.from({length:count},(_,i)=>({
    id:424+i, topic_id:42, post_number:4+i, username:'answer'+i, name:'Author '+i,
    created_at:'2026-09-15T06:00:00Z', cooked:'<p>解决方案 '+(i+1)+'：真实的推荐内容。</p>',
    url:'/t/topic/42/'+(4+i)
  }));
  data.post_stream.posts.push({id:424, topic_id:42, post_number:4, username:'answer0', accepted_answer:true,cooked:'<p>完整的第四楼解决方案。</p>'});
  data.post_stream.stream=[420,424]; data.posts_count=68;
  return data;
}
async function openSolved(t, data=solvedTopic(), options={}) {
  const page=await openFixture(t,{route:'/t/topic/42',random:0,...options});
  await reply(page,'/t/42.json',data);
  await hasText(page,'.cx-thread-posts','推荐一款大米');
  return page;
}

test('solutions: all accepted answers render after the first post, first expanded and actual floors marked',async t=>{
  const page=await openSolved(t);
  await hasText(page,'.cx-solutions','18 条解决方案');
  assert.equal(await page.locator('.cx-solution-item').count(),18);
  assert.equal(await page.locator('.cx-solution-item[open]').count(),1);
  await hasText(page,'.cx-solution-item[open]','解决方案 1');
  assert.equal(await page.locator('.cx-thread-posts > .cx-turn-agent[data-post-number="4"] + .cx-worked .cx-solution-badge').count(),1);
  assert.equal(await page.locator('.cx-solutions').evaluate(el=>el.previousElementSibling.classList.contains('cx-turn-meta')),true);
  const next=page.locator('.cx-solution-item').nth(1);
  await next.locator('summary').focus(); await page.keyboard.press('Enter');
  assert.equal(await next.evaluate(el=>el.open),true);
  await hasText(page,'.cx-solutions','Author 1');
});

test('solutions: legacy single-answer excerpt is safe text and local source remains reachable',async t=>{
  const data=solvedTopic();
  delete data.accepted_answers;
  data.accepted_answer={post_number:4,username:'answer0',excerpt:'<p>Legacy <img src=x onerror="window.solutionXss=true">summary</p>'};
  const page=await openSolved(t,data);
  await hasText(page,'.cx-solutions','1 条解决方案');
  await hasText(page,'.cx-solution-excerpt','Legacy');
  assert.equal(await page.locator('.cx-solutions img, .cx-solutions script').count(),0);
  assert.equal(await page.evaluate(()=>window.solutionXss),undefined);
  await page.locator('[data-solution-locate="4"]').click();
  await page.locator('.cx-thread-posts > [data-post-number="4"].cx-jump-highlight').waitFor();
});

test('solutions: distant accepted floor is lazily located and failed loads can be retried',async t=>{
  const data=solvedTopic(1); data.accepted_answers[0].post_number=45;
  const page=await openSolved(t,data);
  await page.locator('[data-solution-locate="45"]').click();
  await reply(page,'/t/42/45.json',{},503);
  await hasText(page,'.cx-toast','加载失败');
  await page.locator('[data-solution-locate="45"]').click();
  await reply(page,'/t/42/45.json',{post_stream:{posts:[{id:445,post_number:45,topic_id:42,username:'answer0',cooked:'<p>Remote full solution.</p>'}],stream:[420,424,445]},posts_count:68});
  await page.locator('.cx-thread-posts > [data-post-number="45"].cx-jump-highlight').waitFor();
  await hasText(page,'.cx-thread-posts','Remote full solution.');
  assert.equal(await page.locator('.cx-solutions').count(),1);
});

test('solutions: unread window without first post retains the solutions entry and rejects invalid/duplicate targets',async t=>{
  const data=solvedTopic(2);
  data.post_stream.posts=data.post_stream.posts.slice(1);
  data.accepted_answers.push(data.accepted_answers[0],{topic_id:99,post_number:6,username:'foreign'},{post_number:-1});
  const page=await openFixture(t,{route:'/t/topic/42'});
  await reply(page,'/t/42.json',data);
  await hasText(page,'.cx-solutions','2 条解决方案');
  assert.equal(await page.locator('.cx-solution-item').count(),2);
  assert.equal(await page.locator('.cx-thread-posts').evaluate(el=>el.firstElementChild.classList.contains('cx-solutions')),true);
});

test('solutions: unsolved routes and native exit cannot retain or resurrect another topic solutions',async t=>{
  const page=await openSolved(t,solvedTopic(1));
  await hasText(page,'.cx-solutions','1 条解决方案');
  await navigate(page,'/t/topic/43'); await reply(page,'/t/43.json',topic('Unsolved',43));
  await hasText(page,'.cx-thread-posts','Unsolved');
  assert.equal(await page.locator('.cx-solutions, .cx-solution-badge').count(),0);
  await navigate(page,'/t/topic/42'); await waitRequest(page,'/t/42.json',2);
  await navigate(page,'/new?cx_native=1'); await reply(page,'/t/42.json',solvedTopic(1)); await settle(page);
  await assertNative(page);
});

test('solutions: refreshed acceptance state removes badges without replacing the reader or unrelated disclosures',async t=>{
  const page=await openSolved(t,solvedTopic(1),{mockWrites:{'/posts.json':{id:999,topic_id:42}}});
  await hasText(page,'.cx-solutions','1 条解决方案');
  await page.locator('.cx-md-edit').fill('Mock refresh trigger');
  await page.locator('.codex-composer-send').click();
  await waitRequest(page,'/t/42.json',2);
  const data=solvedTopic(1); data.accepted_answers=[]; data.has_accepted_answer=false;
  data.post_stream.posts[1].accepted_answer=false;
  await reply(page,'/t/42.json',data); await settle(page);
  assert.equal(await page.locator('.cx-solutions, .cx-solution-badge').count(),0);
  assert.equal(await page.locator('.cx-thread-posts > [data-post-number="4"]').count(),1);
});

test('solutions: previews alone do not report their source floor as read',async t=>{
  const page=await openFixture(t,{route:'/t/topic/42',clock:true,username:'tester',mockWrites:{'/topics/timings':{}}});
  await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'}));
  await reply(page,'/t/42.json',solvedTopic());
  await page.locator('.cx-solutions').waitFor();
  await page.setViewportSize({width:900,height:450});
  await page.locator('.cx-solutions').evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'}));
  await page.clock.runFor(1300);
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  assert.equal(await page.evaluate(()=>__harness.requests.filter(r=>r.url==='/topics/timings').length),0);
});

test('solutions: dark/light desktop and mobile layouts remain contained',async t=>{
  for(const mode of ['dark','light']) for(const width of [1600,390]) {
    const page=await openSolved(t,solvedTopic(),{rootClass:mode+'-scheme',width});
    await hasText(page,'.cx-solutions','18 条解决方案');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    if(process.env.CODEX_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.CODEX_SCREENSHOT_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.CODEX_SCREENSHOT_DIR,'solutions-'+mode+'-'+width+'.png')});
    }
  }
});
