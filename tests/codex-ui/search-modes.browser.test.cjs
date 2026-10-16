const {test,assert,openFixture,reply,hasText,navigate,settle,waitRequest,requestCount,assertNative}=require('./browser-harness.cjs');
const fs=require('node:fs'),path=require('node:path');
const endpoint=(q,page=1,scope='',id=0)=>'/search.json?q='+encodeURIComponent(q)+'&page='+page+(scope?'&search_context%5Btype%5D='+scope+'&search_context%5Bid%5D='+id:'');
const post=(topicId,n=1,id=topicId*100+n)=>({id,post_number:n,username:'reader',created_at:'2026-10-16T00:00:00Z',blurb:'<b>真实摘要</b> <img src=x onerror="window.injected=true">',topic:{id:topicId,title:'搜索话题 '+topicId,slug:'topic-'+topicId}});
const result=(posts,more=false)=>({posts,more_full_page_results:more});
async function submit(p,q){if(q!==undefined)await p.locator('.cx-search-input').fill(q);await p.locator('.cx-search-input').press('Enter');}
const mode=p=>p.getByRole('combobox',{name:'搜索方式',exact:true});
test('search modes: native default query deduplicates topics within/across pages and retains matching floors',async t=>{
 const p=await openFixture(t,{route:'/search?q=域名'});await reply(p,endpoint('域名'),result([post(1,9),post(1,11),post(2)],true));
 await hasText(p,'.cx-search-results','搜索话题 2');assert.equal(await p.locator('.cx-search-result').count(),2);
 assert.equal(await p.locator('.cx-search-result').first().getAttribute('href'),'/t/topic-1/1/9');
 await hasText(p,'.cx-search-status','已加载 2 个话题');assert.equal(await mode(p).inputValue(),'default');
 await p.locator('.cx-search-more').click();await reply(p,endpoint('域名',2),result([post(1,15),post(3),post(3,2)]));
 await hasText(p,'.cx-search-status','已加载 3 个话题');await hasText(p,'.cx-search-status','当前查询结果已返回完');
 assert.equal(await p.locator('.cx-search-result').count(),3);assert.equal(await p.locator('.cx-search-results img').count(),0);
});
test('search modes: native q directives restore title/all-floor controls, normalize only on explicit selection and preserve quoted phrases',async t=>{
 const q='"in:title" "中文 域名" in:all-posts in:title after:2025-01-01 order:latest';
 const p=await openFixture(t,{route:'/search?q='+encodeURIComponent(q)});await reply(p,endpoint(q),result([post(1,1),post(1,2)]));
 assert.equal(await mode(p).inputValue(),'title');assert.equal(await p.locator('.cx-search-result').count(),1);
 await mode(p).selectOption('all-posts');const all='"in:title" "中文 域名" after:2025-01-01 order:latest in:all-posts';
 assert.equal(await p.locator('.cx-search-input').inputValue(),all);assert.equal(await requestCount(p,endpoint(all)),0,'selector does not submit');
 await submit(p);await reply(p,endpoint(all),result([post(1,2),post(1,3),post(1,3)]));
 await hasText(p,'.cx-search-status','已加载 2 条匹配帖子');assert.equal(await p.locator('.cx-search-result').count(),2);
 await mode(p).selectOption('title');await submit(p);
 const title='"in:title" "中文 域名" after:2025-01-01 order:latest in:title';await reply(p,endpoint(title),result([post(2)]));
 await p.reload();await reply(p,endpoint(title),result([post(2)]));assert.equal(await mode(p).inputValue(),'title');
 await mode(p).selectOption('default');await submit(p);const clean='"in:title" "中文 域名" after:2025-01-01 order:latest';await reply(p,endpoint(clean),result([post(3)]));
 assert.equal(await mode(p).inputValue(),'default');await p.goBack();await reply(p,endpoint(title),result([post(2)]));assert.equal(await mode(p).inputValue(),'title');
});
test('search modes: manually entered directives sync without treating literals or category values as directives',async t=>{
 const p=await openFixture(t,{route:'/search'});await p.locator('.cx-search-input').fill('"in:title" category:"in:all-posts" 中文');
 assert.equal(await mode(p).inputValue(),'default');await p.locator('.cx-search-input').fill('中文 IN:TITLE');assert.equal(await mode(p).inputValue(),'title');
 await p.locator('.cx-search-input').dispatchEvent('compositionstart');await p.locator('.cx-search-input').dispatchEvent('keydown',{key:'Enter',isComposing:true});
 assert.equal(await requestCount(p,endpoint('中文 IN:TITLE')),0);await p.locator('.cx-search-input').dispatchEvent('compositionend');
 await submit(p);await reply(p,endpoint('中文 IN:TITLE'),result([post(1)]));assert.equal(await mode(p).inputValue(),'title');
});
test('search modes: category scope preserves filters; topic scope remains per-post and other tabs do not expose mode',async t=>{
 const q='中文 after:2025-01-01';const p=await openFixture(t,{route:'/search?q='+encodeURIComponent(q)+'&context=category&context_id=4&skip_context=false'});
 await reply(p,endpoint(q,1,'category',4),result([post(1)]));await mode(p).selectOption('title');
 await p.locator('[name="order"]').selectOption('latest_topic');await p.locator('[name="author"]').fill('@alice');await submit(p);
 const next=q+' in:title order:latest_topic user:alice';await reply(p,endpoint(next,1,'category',4),result([post(2)]));await hasText(p,'.cx-search-scope','本分类');
 await navigate(p,'/search?q=中文&context=topic&context_id=42&skip_context=false');await reply(p,endpoint('中文',1,'topic',42),result([post(42,2),post(42,3)]));
 assert.equal(await p.locator('[name="search_mode"]').isVisible(),false);await hasText(p,'.cx-search-status','已加载 2 条匹配帖子');
 await p.locator('[data-search-type="users"]').click();await reply(p,'/search/query?term='+encodeURIComponent('中文')+'&type_filter=user',{users:[{username:'alice',name:'Alice'}]});
 assert.equal(await p.locator('[name="search_mode"]').isVisible(),false);await hasText(p,'.cx-search-results','alice');
});
test('search modes: changing only search mode preserves advanced order values not listed in the form',async t=>{
 const q='中文 order:op_likes category:"开发 调优" before:2026-10-01';
 const p=await openFixture(t,{route:'/search?q='+encodeURIComponent(q)});await reply(p,endpoint(q),result([post(1)]));
 await mode(p).selectOption('title');await submit(p);
 await reply(p,endpoint(q+' in:title'),result([post(2)]));
 assert.equal(new URL(p.url()).searchParams.get('q'),q+' in:title');
});

test('search modes: 50 topics do not stop pagination; duplicates/empty pages and server ending remain accurate',async t=>{
 const p=await openFixture(t,{route:'/search?q=pages'});await reply(p,endpoint('pages'),result(Array.from({length:50},(_,i)=>post(i+1)),true));
 await hasText(p,'.cx-search-status','已加载 50 个话题');await p.locator('.cx-search-more').click();await reply(p,endpoint('pages',2),result([post(1,2),post(51),post(52)],true));
 await hasText(p,'.cx-search-status','已加载 52 个话题');await p.locator('.cx-search-more').click();await reply(p,endpoint('pages',3),result([],true));
 await p.locator('.cx-search-more').waitFor();await p.locator('.cx-search-more').click();await reply(p,endpoint('pages',4),result([]));
 await hasText(p,'.cx-search-status','当前查询结果已返回完');assert.equal(await p.locator('.cx-search-result').count(),52);
});
test('search modes: tenth page reports cap only if server still has results, and errors retain loaded topics',async t=>{
 const p=await openFixture(t,{route:'/search?q=limit'});await reply(p,endpoint('limit'),result([post(1)],true));
 await p.locator('.cx-search-more').click();await reply(p,endpoint('limit',2),{},503);
 await hasText(p,'.cx-search-status','已加载 1 个话题');await p.locator('.cx-search-retry').click();await reply(p,endpoint('limit',2),result([post(2)],true));
 for(let n=3;n<=10;n++){await p.locator('.cx-search-more').click();await reply(p,endpoint('limit',n),result([post(n)],true));}
 await hasText(p,'.cx-search-status','已达 10 页上限');assert.equal(await p.locator('.cx-search-more').count(),0);
});
test('search modes: an empty first page may continue and a server ending at page ten is not a limit warning',async t=>{
 const p=await openFixture(t,{route:'/search?q=ending'});await reply(p,endpoint('ending'),result([],true));
 await hasText(p,'.cx-search-status','已加载 0 个话题');assert.equal(await p.locator('.cx-search-more').count(),1);
 for(let n=2;n<=10;n++){await p.locator('.cx-search-more').click();await reply(p,endpoint('ending',n),result([post(n)],n<10));}
 await hasText(p,'.cx-search-status','已加载 9 个话题');await hasText(p,'.cx-search-status','当前查询结果已返回完');
 assert.equal(await p.locator('.cx-search-more').count(),0);assert.equal((await p.locator('.cx-search-status').innerText()).includes('10 页上限'),false);
 await submit(p,'empty');await reply(p,endpoint('empty'),result([]));await hasText(p,'.cx-search-status','没有匹配结果');
 assert.equal(await p.locator('.cx-search-more').count(),0);
});

test('search modes: mode changes cancel old requests and stale append cannot overwrite the new mode or native exit',async t=>{
 const p=await openFixture(t,{route:'/search?q=term'});await waitRequest(p,endpoint('term'));
 await mode(p).selectOption('all-posts');await submit(p);await reply(p,endpoint('term in:all-posts'),result([post(1,2)],true));
 await reply(p,endpoint('term'),result([post(99)]));await p.locator('.cx-search-more').click();await waitRequest(p,endpoint('term in:all-posts',2));
 await mode(p).selectOption('title');await submit(p);await reply(p,endpoint('term in:title'),result([post(3)]));
 await reply(p,endpoint('term in:all-posts',2),result([post(1,3)]));await settle(p);
 assert.equal(await p.locator('.cx-search-result').count(),1);await hasText(p,'.cx-search-results','搜索话题 3');
 await submit(p,'new');await waitRequest(p,endpoint('new'));await navigate(p,'/search?q=new&cx_native=1');await reply(p,endpoint('new'),result([post(4)]));await settle(p);await assertNative(p);
});
test('search modes: native router preserves q mode and advanced filters in search links',async t=>{
 const p=await openFixture(t,{route:'/search?q=term'});await reply(p,endpoint('term'),result([post(1)]));
 await p.evaluate(()=>{window.Discourse={URL:{routeTo(path){const u=new URL(path,location.origin);for(const k of [...u.searchParams.keys()])if(!['q','context','context_id','skip_context','search_type','expanded'].includes(k))u.searchParams.delete(k);history.pushState({},'',u.pathname+u.search);}}};});
 await mode(p).selectOption('title');await submit(p);await reply(p,endpoint('term in:title'),result([post(2)]));
 assert.equal(new URL(p.url()).searchParams.get('q'),'term in:title');assert.equal(await mode(p).inputValue(),'title');
});
test('search modes: new filter stays readable in light/dark desktop and mobile',async t=>{
 for(const theme of ['dark','light'])for(const width of [1600,390]){
 const p=await openFixture(t,{route:'/search?q=域名%20in:title',rootClass:theme+'-scheme',width});await reply(p,endpoint('域名 in:title'),result([post(1)]));
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await mode(p).isVisible(),true);
 if(process.env.CODEX_SCREENSHOT_DIR){fs.mkdirSync(process.env.CODEX_SCREENSHOT_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.CODEX_SCREENSHOT_DIR,'search-mode-'+theme+'-'+width+'.png')});}
 }
});
