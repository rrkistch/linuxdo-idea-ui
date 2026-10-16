const {test,assert,openFixture,topic,reply,hasText,navigate,settle,waitRequest,requestCount,assertNative}=require('./browser-harness.cjs');
function fullThread(id=42,total=60) {
 const d=topic('Continuous reading',id);
 d.post_stream.posts=Array.from({length:total},(_,i)=>({id:id*100+i+1,topic_id:id,post_number:i+1,username:'reader'+(i+1),
 reply_to_post_number:i>=20 && i<40 ? 2 : null,cooked:'<p>Floor '+(i+1)+' '+('阅读内容。'.repeat(50))+'</p>'}));
 d.post_stream.stream=d.post_stream.posts.map(p=>p.id);d.posts_count=total;return d;
}
const url=(id,first,last)=>'/t/'+id+'/posts.json?'+Array.from({length:last-first+1},(_,i)=>'post_ids[]='+(id*100+first+i)).join('&');
async function open(t,options={}) {
 const p=await openFixture(t,{route:'/t/topic/42',random:0,...options});
 await p.evaluate(()=>localStorage.setItem('linuxdo-codex-reading-mode','thread'));await p.reload();
 const d=fullThread();d.post_stream.posts=d.post_stream.posts.slice(0,20);
 await reply(p,'/t/42.json',d);await p.locator('.cx-post-unit[data-unit-post="20"]').waitFor();return p;
}
async function nearEnd(p) {
 await p.locator('.cx-view-detail').evaluate(el=>{el.scrollTop=Math.max(0,el.scrollHeight-el.clientHeight-240);el.dispatchEvent(new Event('scroll'));});
}
async function anchor(p) {
 return p.locator('.cx-view-detail').evaluate(el=>{
 const top=el.getBoundingClientRect().top;
 const node=[...el.querySelectorAll('.cx-post-unit .cx-cooked, .cx-post-unit .cx-turn-user-bubble')].find(n=>n.getBoundingClientRect().bottom>top);
 return {number:Number(node.closest('[data-post-number]').dataset.postNumber),top:node.getBoundingClientRect().top};
 });
}
test('thread auto: prefetch near bottom continues through 60 floors without clicking or looping',async t=>{
 const p=await open(t);assert.equal(await requestCount(p,url(42,21,40)),0);
 await nearEnd(p);await waitRequest(p,url(42,21,40));
 for(let i=0;i<8;i++)await p.locator('.cx-view-detail').dispatchEvent('scroll');
 assert.equal(await requestCount(p,url(42,21,40)),1);
 await hasText(p,'.cx-thread-pages','正在加载');
 // Move away during the slow response. Preserve the reader's latest anchor.
 await p.locator('.cx-post-unit[data-unit-post="10"] .cx-cooked').evaluate(el=>el.scrollIntoView({block:'start'}));
 const before=await anchor(p);
 await reply(p,url(42,21,40),{posts:fullThread().post_stream.posts.slice(20,40)});
 await p.locator('.cx-post-unit[data-unit-post="40"]').waitFor();await settle(p);
 const after=await anchor(p);assert.equal(after.number,before.number);assert.ok(Math.abs(after.top-before.top)<3);
 assert.equal(await requestCount(p,url(42,41,60)),0,'reordering is not a new scroll gesture');
 await nearEnd(p);await waitRequest(p,url(42,41,60));
 await reply(p,url(42,41,60),{posts:fullThread().post_stream.posts.slice(40)});
 await hasText(p,'.cx-thread-pages','已加载全部回复');
 assert.equal(await p.locator('.cx-post-unit').count(),60);
 for(let i=0;i<5;i++)await p.locator('.cx-view-detail').dispatchEvent('scroll');
 assert.equal(await requestCount(p,url(42,41,60)),1);
 assert.equal(await p.getByRole('button',{name:'加载后续楼层',exact:true}).count(),0);
});
test('thread auto: HTTP failure pauses automatic attempts and retries only explicitly',async t=>{
 const p=await open(t);await nearEnd(p);await reply(p,url(42,21,40),{},403);
 await hasText(p,'.cx-thread-pages','加载失败');
 for(let i=0;i<4;i++){await p.locator('.cx-view-detail').evaluate(el=>{el.scrollTop-=30;el.dispatchEvent(new Event('scroll'));});await nearEnd(p);}
 await settle(p);assert.equal(await requestCount(p,url(42,21,40)),1);
 await p.getByRole('button',{name:'重试加载',exact:true}).click();await waitRequest(p,url(42,21,40),2);
 await reply(p,url(42,21,40),{posts:fullThread().post_stream.posts.slice(20,40)});
 await p.locator('.cx-post-unit[data-unit-post="40"]').waitFor();
 assert.equal(await p.getByRole('button',{name:'重试加载',exact:true}).count(),0);
});
test('thread auto: cancelled late response cannot alter next topic or restore native shell',async t=>{
 const p=await open(t);await nearEnd(p);await waitRequest(p,url(42,21,40));
 await navigate(p,'/t/topic/43');const next=fullThread(43);next.post_stream.posts=next.post_stream.posts.slice(0,20);await reply(p,'/t/43.json',next);
 await p.locator('.cx-post-unit[data-unit-post="20"]').waitFor();await nearEnd(p);await waitRequest(p,url(43,21,40));
 await reply(p,url(42,21,40),{posts:fullThread().post_stream.posts.slice(20,40)});await settle(p);
 assert.equal(await p.locator('.cx-post-unit').count(),20);
 await navigate(p,'/new?cx_native=1');await reply(p,url(43,21,40),{posts:fullThread(43).post_stream.posts.slice(20,40)});await settle(p);await assertNative(p);
});
test('thread auto: moving back to the top does not start a forward page',async t=>{
 const p=await open(t);await p.locator('.cx-view-detail').evaluate(el=>{el.scrollTop=200;el.dispatchEvent(new Event('scroll'));el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});
 await settle(p);assert.equal(await requestCount(p,url(42,21,40)),0);
});

test('thread auto: a short first window fills available space but stops once the viewport is filled',async t=>{
 const p=await openFixture(t,{route:'/t/topic/42'});
 await p.evaluate(()=>localStorage.setItem('linuxdo-codex-reading-mode','thread'));await p.reload();
 const d=fullThread(42,8);d.post_stream.posts=d.post_stream.posts.slice(0,1);d.post_stream.posts[0].cooked='<p>Short first post.</p>';
 await reply(p,'/t/42.json',d);await waitRequest(p,url(42,2,8));
 await reply(p,url(42,2,8),{posts:fullThread(42,8).post_stream.posts.slice(1)});
 await hasText(p,'.cx-thread-pages','已加载全部回复');await settle(p);
 assert.equal(await requestCount(p,url(42,2,8)),1);
 assert.equal(await p.locator('.cx-post-unit').count(),8);
});
test('thread auto: malformed responses leave the cursor retryable rather than dropping a page',async t=>{
 const p=await open(t);await nearEnd(p);
 await reply(p,url(42,21,40),{message:'No post array'});
 await hasText(p,'.cx-thread-pages','加载失败');await nearEnd(p);await settle(p);
 assert.equal(await requestCount(p,url(42,21,40)),1);
 await p.getByRole('button',{name:'重试加载',exact:true}).click();
 await reply(p,url(42,21,40),{posts:fullThread().post_stream.posts.slice(20,40)});
 await p.locator('.cx-post-unit[data-unit-post="40"]').waitFor();
});
test('thread auto: status and retry controls fit desktop and mobile',async t=>{
 for(const [mode,width] of [['dark',1600],['light',390]]) {
  const p=await open(t,{width,rootClass:mode+'-scheme'});
  await nearEnd(p);await reply(p,url(42,21,40),{},503);
  await hasText(p,'.cx-thread-pages','加载失败');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(process.env.CODEX_SCREENSHOT_DIR){
   const fs=require('node:fs'),path=require('node:path');fs.mkdirSync(process.env.CODEX_SCREENSHOT_DIR,{recursive:true});
   await p.screenshot({path:path.join(process.env.CODEX_SCREENSHOT_DIR,'auto-retry-'+mode+'-'+width+'.png')});
   await p.getByRole('button',{name:'重试加载',exact:true}).click();
   await hasText(p,'.cx-thread-pages','正在加载更多回复');
   await p.screenshot({path:path.join(process.env.CODEX_SCREENSHOT_DIR,'auto-loading-'+mode+'-'+width+'.png')});
  }
 }
});
