const {test, assert, openFixture, topic, reply, hasText, navigate, settle, waitRequest} = require('./browser-harness.cjs');
const fs = require('node:fs');
const path = require('node:path');
function data() {
  const d=topic('小火箭跟评',42);
  d.post_stream.posts.push({id:422,post_number:2,username:'binaryMan',cooked:'<p>那就是一直在交，满20年就行了。</p>',boosts:[
    {id:1,user:{username:'alice',name:'Alice'},cooked:'<p>不是15吗 变20了？</p>'},
    {id:2,user:{username:'bob'},cooked:'<p><img class="emoji" alt="⬅️" src="/emoji.png"> 前年就变20了</p>'},
    {id:3,user:{username:'carol'},cooked:'<p>'+ '这是一条比较长的跟评。'.repeat(12) +'</p>'}
  ]});
  d.post_stream.stream=[420,422]; return d;
}
async function open(t,options={}) {
  const page=await openFixture(t,{route:'/t/topic/42',...options});
  await reply(page,'/t/42.json',data());
  await hasText(page,'.cx-thread-posts','满20年'); return page;
}
test('boosts: actual post boosts appear under their floor, retain emoji and expand long text',async t=>{
  const page=await open(t);
  const bar=page.locator('.cx-boost-slot[data-boost-post="2"]');
  await hasText(page,'.cx-boost-bar','不是15吗');
  assert.equal(await bar.locator('.cx-boost-chip').count(),3);
  assert.match(await bar.innerText(),/⬅️ 前年/);
  assert.equal(await bar.locator('img').count(),0);
  assert.equal(await bar.evaluate(el=>el.previousElementSibling.classList.contains('cx-worked')),true);
  assert.equal(await page.locator('.cx-cooked .cx-boost-chip').count(),0);
  const details=bar.locator('details');
  await details.locator('summary').focus(); await page.keyboard.press('Enter');
  assert.equal(await details.evaluate(el=>el.open),true);
  assert.match(await details.locator('.cx-boost-full').innerText(),/跟评/);
  assert.equal(await bar.locator('[data-cx-user="alice"]').getAttribute('href'),'/u/alice');
});
test('boosts: refresh updates comments without duplication and topic changes clear old boosts',async t=>{
  const page=await open(t,{mockWrites:{'/posts.json':{id:423}}});
  await page.locator('.cx-md-edit').fill('mock reply');
  await page.locator('.codex-composer-send').click();
  await waitRequest(page,'/t/42.json',2);
  const d=data(); d.post_stream.posts[1].boosts=[{id:4,user:{username:'new'},cooked:'<p>Updated &lt;script&gt;safe&lt;/script&gt;</p>'}];
  await reply(page,'/t/42.json',d);
  await hasText(page,'.cx-boost-bar','Updated <script>safe</script>');
  assert.equal(await page.locator('.cx-boost-chip').count(),1);
  assert.equal(await page.locator('.cx-boost-slot script').count(),0);
  await navigate(page,'/t/topic/43'); await reply(page,'/t/43.json',topic('Other',43));
  await settle(page); assert.equal(await page.locator('.cx-boost-chip').count(),0);
});
test('boosts: compact chips fit dark/light desktop and mobile',async t=>{
  for(const mode of ['dark','light']) for(const width of [1600,390]) {
    const page=await open(t,{width,rootClass:mode+'-scheme'});
    await hasText(page,'.cx-boost-bar','不是15吗');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    if(process.env.CODEX_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.CODEX_SCREENSHOT_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.CODEX_SCREENSHOT_DIR,`boosts-${mode}-${width}.png`)});
    }
  }
});
