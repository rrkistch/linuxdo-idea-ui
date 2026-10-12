const {test, assert, openFixture, topic, list, reply, hasText} = require('./browser-harness.cjs');
const fs=require('node:fs');
const path=require('node:path');

test('desktop visual: reference layout contains content in dark/light at five widths',async t=>{
  for (const mode of ['dark','light']) for (const width of [1920,1600,1280,900,390]) {
    const page=await openFixture(t,{route:'/t/client/42',rootClass:`${mode}-scheme`,width,random:0,
      categories:[{id:4,name:'开发调优',slug:'develop',topic_count:28},{id:14,name:'资源荟萃',slug:'resource',topic_count:12}]});
    const data=topic('请求客户端的取消与重试',42);
    data.category_id=4;
    data.post_stream.posts[0].cooked='<p>如何让多个并发请求共享客户端，同时独立取消？</p>';
    data.post_stream.posts.push({id:422,post_number:2,username:'developer',cooked:'<p>建议把取消信号作为每次调用的参数，并在请求结束时清理监听器。</p><p>切换页面后，旧请求的响应不应该覆盖新页面。可以把请求归属和版本一起校验。</p>'},
      {id:423,post_number:3,username:'reviewer',reply_to_post_number:2,cooked:'<p>同意。失败时保留原始输入，取消和超时也需要分别处理。</p><pre><code class="language-typescript">const response = await client.get(url, { signal });</code></pre>'});
    data.post_stream.stream=data.post_stream.posts.map(p=>p.id); data.posts_count=3;
    await reply(page,'/t/42.json',data);
    await hasText(page,'.cx-thread-posts','取消和超时');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('.cx-thread-posts').evaluate(el=>el.getBoundingClientRect().width<=761),true);
    if(width>900){
      assert.equal(await page.locator('.codex-app-strip').isVisible(),true);
      assert.equal(Math.round((await page.locator('.codex-app-strip').boundingBox()).width),48);
    }else assert.equal(await page.locator('.cx-code-panel').isVisible(),false);
    const input=await page.locator('.codex-composer').boundingBox();
    assert.ok(input.x>=0 && input.x+input.width<=width+1);
    if(process.env.CODEX_SCREENSHOT_DIR){
      fs.mkdirSync(process.env.CODEX_SCREENSHOT_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.CODEX_SCREENSHOT_DIR,`desktop-${mode}-${width}.png`)});
      if(width===1600){
        await page.locator('.cx-think > summary').first().click();
        await page.locator('.cx-tools > summary').first().click();
        await page.locator('[data-code-view-toggle] [data-v="diff"]').click();
        await page.screenshot({path:path.join(process.env.CODEX_SCREENSHOT_DIR,`desktop-${mode}-expanded-diff.png`)});
      }
    }
  }
});

test('desktop visual: app strip controls are functional and sidebar can reopen when collapsed',async t=>{
  const page=await openFixture(t,{width:1600});
  await reply(page,'/new.json',list('List'));
  await page.locator('[data-strip-action="sidebar"]').click();
  assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('codex-rail-collapsed')),true);
  await page.locator('[data-strip-action="sidebar"]').click();
  assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('codex-rail-collapsed')),false);
  await page.locator('[data-strip-action="search"]').click();
  await page.locator('.cx-search-input').waitFor();
  await page.locator('[data-strip-action="bookmarks"]').click();
  await reply(page,'/bookmarks.json',list('Saved topic'));
  await hasText(page,'.cx-thread-rows','Saved topic');
  await page.locator('[data-strip-action="topics"]').click();
  await reply(page,'/latest.json',list('Latest topic'));
  await hasText(page,'.cx-thread-rows','Latest topic');
  await page.locator('[data-strip-action="activity"]').click();
  await page.waitForURL('**/my/activity');
});
