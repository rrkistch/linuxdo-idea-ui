const {test,assert,openFixture,topic,reply,hasText,navigate,settle,waitRequest}=require('./browser-harness.cjs');
const fs=require('node:fs'),path=require('node:path');
function thread(){const d=topic('Discussion',42);d.post_stream.posts=Array.from({length:8},(_,i)=>({id:421+i,topic_id:42,post_number:i+1,username:'dev'+(i+1),reply_to_post_number:({5:2,6:5,7:6,8:8})[i+1],cooked:`<p>Floor ${i+1} ${'正文内容。'.repeat(30)}</p>`,boosts:i===4?[{id:1,user:{username:'boost'},cooked:'<p>Short comment</p>'}]:[]}));d.post_stream.stream=d.post_stream.posts.map(p=>p.id);d.posts_count=8;return d;}
async function open(t,options={}){const p=await openFixture(t,{route:'/t/topic/42',random:0,...options});await reply(p,'/t/42.json',thread());await hasText(p,'.cx-thread-posts','Floor 8');return p;}
const order=p=>p.locator('.cx-post-unit').evaluateAll(es=>es.map(e=>Number(e.dataset.unitPost)));
test('thread mode: global preference, ordered tree, grouped actions and original content survive toggles',async t=>{
 const p=await open(t);await p.locator('.cx-md-edit').fill('Keep draft');
 await p.getByRole('button',{name:'楼中楼',exact:true}).click();
 assert.deepEqual(await order(p),[1,2,5,6,7,3,4,8]);
 await hasText(p,'.cx-post-unit[data-unit-post="5"]','Short comment');
 assert.equal(await p.locator('.cx-post-unit[data-unit-post="5"] .cx-turn-activity').count(),0);
 await p.locator('.cx-post-unit[data-unit-post="5"] [data-action="reply"]').click();await hasText(p,'.cx-compose-target','#5');
 await p.getByRole('button',{name:'楼层顺序',exact:true}).click();await hasText(p,'.cx-md-edit','Keep draft');
 assert.equal(await p.locator('.cx-thread-posts > .cx-turn-agent').count(),7);
 await p.getByRole('button',{name:'楼中楼',exact:true}).click();await p.reload();await reply(p,'/t/42.json',thread());
 await p.locator('.cx-post-unit').first().waitFor();assert.deepEqual(await order(p),[1,2,5,6,7,3,4,8]);
 await navigate(p,'/t/topic/43');await reply(p,'/t/43.json',topic('Other',43));await p.locator('.cx-post-unit').first().waitFor();
 assert.equal(await p.getByRole('button',{name:'楼中楼',exact:true}).getAttribute('aria-pressed'),'true');
});
test('thread mode: missing parents are explicit, fetched on demand, and late responses stay owned',async t=>{
 const p=await openFixture(t,{route:'/t/topic/42'});const d=thread();d.post_stream.posts=d.post_stream.posts.filter(x=>x.post_number!==5);
 await reply(p,'/t/42.json',d);await p.getByRole('button',{name:'楼中楼',exact:true}).click();
 await p.getByRole('button',{name:'上级 #5 未加载 · 查看',exact:true}).click();await waitRequest(p,'/t/42/5.json');
 await reply(p,'/t/42/5.json',{post_stream:{posts:[thread().post_stream.posts[4]],stream:thread().post_stream.stream}});
 await p.locator('.cx-post-unit[data-unit-post="5"]').waitFor();assert.deepEqual(await order(p),[1,2,5,6,7,3,4,8]);
});
test('thread mode: switch preserves current floor and pending refresh waits for explicit viewing',async t=>{
 const p=await open(t,{mockWrites:{'/posts.json':{id:999}}});
 const floor=p.locator('.cx-turn-agent[data-post-number="5"] .cx-cooked');await floor.evaluate(el=>el.scrollIntoView({block:'start'}));
 const before=await floor.evaluate(el=>el.getBoundingClientRect().top);
 await p.getByRole('button',{name:'楼中楼',exact:true}).click();assert.ok(Math.abs(await floor.evaluate(el=>el.getBoundingClientRect().top)-before)<3);
 await p.locator('.cx-md-edit').fill('Mock reply');await p.locator('.codex-composer-send').click();
 const d=thread();d.post_stream.posts.push({id:429,post_number:9,reply_to_post_number:2,username:'new',cooked:'<p>New answer</p>'});d.post_stream.stream.push(429);d.posts_count=9;
 await reply(p,'/t/42.json',d);await p.getByRole('button',{name:'有新回复 · 查看',exact:true}).waitFor();
 assert.equal(await p.locator('.cx-post-unit[data-unit-post="9"]').count(),0);
 await p.getByRole('button',{name:'有新回复 · 查看',exact:true}).click();await hasText(p,'.cx-post-unit[data-unit-post="9"]','New answer');
});
test('thread mode: light/dark layouts stay contained at four widths',async t=>{
 for(const mode of ['dark','light'])for(const width of [1600,1280,900,390]){const p=await open(t,{width,rootClass:mode+'-scheme'});await p.getByRole('button',{name:'楼中楼',exact:true}).click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(process.env.CODEX_SCREENSHOT_DIR){fs.mkdirSync(process.env.CODEX_SCREENSHOT_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.CODEX_SCREENSHOT_DIR,`thread-${mode}-${width}.png`)});}}
});
test('thread mode: automatic forward paging retains retry and stream-based ordering',async t=>{
 const p=await openFixture(t,{route:'/t/topic/42'});const d=thread();d.post_stream.posts=d.post_stream.posts.slice(0,3).map(post=>({...post,cooked:post.cooked.repeat(4)}));
 await reply(p,'/t/42.json',d);await p.getByRole('button',{name:'楼中楼',exact:true}).click();
 const url='/t/42/posts.json?'+[424,425,426,427,428].map(id=>'post_ids[]='+id).join('&');
 await p.locator('.cx-view-detail').evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'));});
 await reply(p,url,{},503);await hasText(p,'.cx-thread-pages','加载失败');
 await p.getByRole('button',{name:'重试加载',exact:true}).click();await reply(p,url,{posts:thread().post_stream.posts.slice(3)});
 await p.locator('.cx-post-unit[data-unit-post="8"]').waitFor();assert.deepEqual(await order(p),[1,2,5,6,7,3,4,8]);
 await hasText(p,'.cx-thread-pages','已加载全部回复');
 await navigate(p,'/new?cx_native=1');await settle(p);assert.equal(await p.locator('.cx-reading-mode').count(),0);
});

test('thread mode: original cross-topic quotes, solutions and boosts stay attached to their floor',async t=>{
 const p=await openFixture(t,{route:'/t/topic/42'});const d=thread();
 d.accepted_answers=[{post_number:5,username:'dev5',cooked:'<p>Accepted</p>'}];d.has_accepted_answer=true;
 d.post_stream.posts[4].cooked+='<aside class="quote" data-topic="90" data-post="1"><div class="title">Source</div><blockquote>Original quote</blockquote></aside>';
 await reply(p,'/t/42.json',d);await p.getByRole('button',{name:'楼中楼',exact:true}).click();
 assert.equal(await p.locator('.cx-post-unit[data-unit-post="5"] .cx-solution-badge').count(),1);
 await hasText(p,'.cx-post-unit[data-unit-post="5"]','Short comment');
 assert.equal(await p.locator('.cx-post-unit[data-unit-post="5"] .cx-jump-src').getAttribute('href'),'/t/topic/90/1');
 await p.locator('.cx-post-unit[data-unit-post="5"] .cx-jump-src').click();await reply(p,'/t/90.json',topic('Source',90));await hasText(p,'.cx-thread-posts','Source body');
});
test('thread mode: pending parent response cannot resurrect a departed topic',async t=>{
 const p=await openFixture(t,{route:'/t/topic/42'});const d=thread();d.post_stream.posts=d.post_stream.posts.filter(x=>x.post_number!==5);
 await reply(p,'/t/42.json',d);await p.getByRole('button',{name:'楼中楼',exact:true}).click();
 await p.getByRole('button',{name:'上级 #5 未加载 · 查看',exact:true}).click();await waitRequest(p,'/t/42/5.json');
 await navigate(p,'/t/topic/43');await reply(p,'/t/43.json',topic('Other topic',43));
 await reply(p,'/t/42/5.json',{post_stream:{posts:[thread().post_stream.posts[4]],stream:thread().post_stream.stream}});await settle(p);
 await hasText(p,'.cx-thread-posts','Other topic');assert.deepEqual(await order(p),[1]);
});
test('thread mode: activity stays root-only after changing project and code scroll survives mode changes',async t=>{
 const p=await open(t,{width:1600});await p.getByRole('button',{name:'楼中楼',exact:true}).click();
 await p.locator('[data-workspace-menu]').click();await p.locator('[data-project-id="task-pipeline"]').click();
 assert.equal(await p.locator('.cx-post-unit[data-unit-post="5"] .cx-turn-activity').count(),0);
 const code=p.locator('[data-code-body]');await code.evaluate(el=>el.scrollTop=120);
 const before=await code.evaluate(el=>el.scrollTop);
 await p.getByRole('button',{name:'楼层顺序',exact:true}).click();
 assert.equal(await code.evaluate(el=>el.scrollTop),before);
 assert.equal(await p.locator('.cx-turn-agent[data-post-number="5"] .cx-turn-activity').count(),1);
});
test('thread mode: hidden branches never duplicate reading-time accrual',async t=>{
 const p=await openFixture(t,{route:'/t/topic/42',clock:true,mockWrites:{'/topics/timings':{}}});
 await p.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'}));
 const d=thread();d.post_stream.posts[4].cooked='<p>'+('Visible answer. '.repeat(300))+'</p>';
 await reply(p,'/t/42.json',d);await p.getByRole('button',{name:'楼中楼',exact:true}).click();
 await p.locator('.cx-post-unit[data-unit-post="5"] .cx-cooked').evaluate(el=>el.scrollIntoView({block:'start'}));
 await p.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'}));
 await p.clock.runFor(2100);await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 const values=await p.evaluate(()=>__harness.requests.filter(r=>r.url==='/topics/timings').map(r=>new URLSearchParams(r.body).get('timings[5]')));
 assert.ok(values.some(v=>Number(v)>0));assert.ok(values.every(v=>Number(v)<=3000));
 assert.equal(await p.locator('.cx-branch-reply[data-post-number="5"]').count(),0);
});

// Persist the global preference before navigation, reproducing normal refresh/new-topic entry.
for (const direction of ['newer', 'older']) {
 test('thread mode: persisted-mode startup enables ' + direction + ' paging after initial load', async t => {
  const p=await openFixture(t,{route:'/new'});
  await reply(p,'/new.json',{topic_list:{topics:[]}});
  await p.evaluate(()=>localStorage.setItem('linuxdo-codex-reading-mode','thread'));
  await navigate(p,'/t/topic/42'); await p.reload();
  const d=thread();
  d.post_stream.posts=direction==='newer' ? d.post_stream.posts.slice(0,3) : d.post_stream.posts.slice(3);
  d.post_stream.posts=d.post_stream.posts.map(post=>({...post,cooked:post.cooked.repeat(4)}));
  await reply(p,'/t/42.json',d);
  await p.locator('.cx-post-unit').first().waitFor();
  const label=direction==='newer' ? '重试加载' : '加载更早楼层';
  const button=p.getByRole('button',{name:label,exact:true});
  if(direction==='older') assert.equal(await button.isDisabled(),false,'startup must release the paging control');
  else await hasText(p,'.cx-thread-pages','自动加载更多回复');
  const numbers=direction==='newer' ? [424,425,426,427,428] : [421,422,423];
  const url='/t/42/posts.json?'+numbers.map(id=>'post_ids[]='+id).join('&');
  if(direction==='older') await button.click();
  else await p.locator('.cx-view-detail').evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'));});
  await waitRequest(p,url);
  if(direction==='older') assert.equal(await p.locator('.cx-thread-pages [data-page-label]').isDisabled(),true);
  assert.equal(await p.locator('.cx-thread-pages').getAttribute('aria-busy'),'true');
  await reply(p,url,{},503);
  await hasText(p,'.cx-toast','加载失败');
  await button.waitFor({state:'visible'});
  assert.equal(await button.isDisabled(),false,'failure must allow retry');
  await button.click(); await waitRequest(p,url,2);
  await reply(p,url,{posts:thread().post_stream.posts.filter(post=>numbers.includes(post.id))});
  await p.locator('.cx-post-unit[data-unit-post="8"]').waitFor(); await settle(p);
  assert.deepEqual(await order(p),[1,2,5,6,7,3,4,8]);
  assert.equal(await p.locator('.cx-thread-pages button:visible').count(),0);
  await navigate(p,'/t/topic/43');
  const next=thread(); next.id=43; next.post_stream.posts=next.post_stream.posts.slice(0,3).map(post=>({...post,topic_id:43}));
  await reply(p,'/t/43.json',next);
  await hasText(p,'.cx-thread-pages','自动加载更多回复');
  assert.equal(await p.locator('.cx-thread-pages').getAttribute('aria-busy'),'false');
 });
}
