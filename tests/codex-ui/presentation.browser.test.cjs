const { test, assert, openFixture, topic, reply, hasText, navigate, settle } = require("./browser-harness.cjs");
const fs = require("node:fs");
const path = require("node:path");

function conversation() {
  const data = topic("请求客户端的取消与重试", 42);
  data.post_stream.posts[0].cooked = "<p>如何让多个并发请求共享客户端，同时独立取消？</p>";
  for (let n = 2; n <= 4; n++) data.post_stream.posts.push({
    id: 420 + n, post_number: n, username: `developer${n}`, name: `Developer ${n}`,
    cooked: `<p>第 ${n} 条原始回复：每个请求使用独立的 AbortSignal，重试时也要保留取消状态。</p><p>可以给失败和取消分别加上回归用例。</p>`,
  });
  data.post_stream.stream = data.post_stream.posts.map(p => p.id);
  data.posts_count = data.post_stream.posts.length;
  return data;
}
async function openThread(t, options = {}) {
  const page = await openFixture(t, { route: "/t/client/42", random: 0, ...options });
  await reply(page, "/t/42.json", conversation());
  await hasText(page, ".cx-thread-posts", "第 2 条原始回复");
  return page;
}

test("presentation: replies have stable, keyboard accessible activity outside original content", async t => {
  const page = await openThread(t);
  const turn = page.locator('.cx-turn-agent[data-post-number="2"]');
  assert.equal(await page.locator(".cx-turn-activity").count(), 3);
  assert.equal(await page.locator(".cx-cooked [data-codex-decorative], .cx-turn-user .cx-turn-activity").count(), 0);
  const original = await turn.locator(".cx-cooked").innerHTML();
  const activity = await turn.locator(".cx-turn-activity").innerText();
  assert.equal(new Set(await page.locator(".cx-think summary").allTextContents()).size, 3, "different replies receive varied timings");
  const thinking = turn.locator("details.cx-think");
  assert.equal(await thinking.getAttribute("open"), null);
  await thinking.locator("summary").focus();
  await page.keyboard.press("Enter");
  assert.equal(await thinking.evaluate(el => el.open), true);
  const tools = turn.locator("details.cx-tools");
  await tools.locator(":scope > summary").click();
  assert.equal(await tools.evaluate(el => el.open), true);
  assert.match(await tools.innerText(), /src\/client.ts/);
  const command = tools.locator("details.cx-runline").first();
  assert.equal(await command.locator("pre").isVisible(), false);
  await command.locator("summary").focus();
  await page.keyboard.press("Space");
  assert.equal(await command.locator("pre").isVisible(), true);
  const counts = await page.evaluate(() => [__harness.requests.length, __harness.frames]);
  await settle(page, 350);
  assert.deepEqual(await page.evaluate(() => [__harness.requests.length, __harness.frames]), counts, "activity stays idle");
  await navigate(page, "/search");
  await page.locator(".cx-search-input").waitFor();
  await navigate(page, "/t/client/42");
  await reply(page, "/t/42.json", conversation());
  await hasText(page, ".cx-thread-posts", "第 2 条原始回复");
  assert.equal(await thinking.evaluate(el => el.open), true);
  assert.equal(await tools.evaluate(el => el.open), true);
  assert.equal(await command.evaluate(el => el.open), true, "individual command disclosure survives rerender");
  assert.equal(await turn.locator(".cx-cooked").innerHTML(), original);
  await thinking.locator("summary").click();
  await tools.locator(":scope > summary").click();
  assert.equal(await turn.locator(".cx-turn-activity").innerText(), activity);
  assert.equal(await page.locator(".cx-turn-activity").count(), 3);
});

test("presentation: activity follows compact Codex rows and truncates long commands without losing output", async t => {
  const page = await openThread(t, { width: 390 });
  const tools = page.locator(".cx-tools").first();
  const summary = tools.locator(":scope > summary");
  assert.match(await summary.innerText(), /运行了命令|已使用 Codey Fastctx 集成/);
  assert.match(await page.locator(".cx-think > summary").first().innerText(), /^用时 \d+秒$/);
  const icon = await summary.locator(".cx-activity-icon").boundingBox();
  const text = await summary.locator(".cx-activity-label").boundingBox();
  const chevron = await summary.locator(".cx-activity-chevron").boundingBox();
  assert.ok(icon.x < text.x && text.x + text.width <= chevron.x + 1, "icon precedes text and chevron follows it");
  await summary.click();
  const command = tools.locator("details.cx-runline").first();
  const label = command.locator(".cx-activity-label");
  assert.match(await label.innerText(), /^已在 \d+s 内运行 /);
  assert.equal(await label.evaluate(el => getComputedStyle(el).textOverflow), "ellipsis");
  assert.equal(await label.getAttribute("title"), await label.innerText(), "full command is available on hover");
  const hiddenCount = await page.locator(".cx-runline[open]").count();
  assert.equal(hiddenCount, 0);
  await command.locator("summary").click();
  assert.equal(await command.locator("pre").isVisible(), true);
  assert.match(await command.locator("pre").innerText(), /Get-Content/);
  assert.equal(await page.locator(".cx-runline[open]").count(), 1, "command outputs expand independently");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test("presentation: explicit disabled preferences remain disabled", async t => {
  const page = await openThread(t, { presentationPrefs: { showThinking: false, showRunlines: false } });
  assert.equal(await page.locator(".cx-turn-activity").count(), 0);
});

test("presentation: site disclosure styles cannot add leading triangles or stack Codex rows", async t => {
  for (const mode of ["dark", "light"]) for (const width of [1600, 390]) {
    const page = await openFixture(t, { route: "/t/client/42", random: 0, rootClass: `${mode}-scheme`, width });
    const data = conversation();
    data.post_stream.posts[1].reply_count = 1;
    data.post_stream.posts[2].reply_to_post_number = 2;
    data.post_stream.posts[2].cooked += '<details class="original-details"><summary>原帖折叠内容</summary><p>原帖详情保持原样</p></details>';
    await reply(page, "/t/42.json", data);
    await page.locator('.cx-reply-branch[data-parent-post="422"]').waitFor();
    // Load competing site CSS after the actual userscript entry has rendered.
    await page.addStyleTag({ content: `
      html body details > summary { display: list-item !important; list-style: disclosure-closed inside !important; }
      html body details[open] > summary { list-style-type: disclosure-open !important; }
      html body details > summary::marker { content: "▸ "; }
      html body details > summary::before { content: "▸"; display: inline-block; }
      html body details[open] > summary::before { content: "▾"; }
      html body details > summary::after { content: "▸"; display: inline-block; }
      html body details > summary > span { display: block; }
    ` });
    const turn = page.locator('.cx-turn-agent[data-post-number="2"]');
    const tools = turn.locator('.cx-tools > summary');
    await tools.click();
    const rows = [tools, turn.locator('.cx-think > summary'), turn.locator('.cx-runline > summary').first(),
      page.locator('.cx-reply-branch[data-parent-post="422"] > summary')];
    for (const row of rows) {
      const checkRow = async () => {
        const styles = await row.evaluate(el => ({
          display: getComputedStyle(el).display,
          listStyle: getComputedStyle(el).listStyleType,
          markers: ["::marker", "::before", "::after"].map(pseudo => getComputedStyle(el, pseudo).content),
          boxes: [...el.children].map(child => {
            const { x, y, width, height } = child.getBoundingClientRect();
            return { x, y, width, height };
          }),
        }));
        assert.equal(styles.display, "flex", "site CSS must not restore list-item layout");
        assert.equal(styles.listStyle, "none");
        assert.ok(styles.markers.every(content => content === "none" || content === '""'), "no extra pseudo-element triangles");
        for (let i = 1; i < styles.boxes.length; i++) {
          const a = styles.boxes[i - 1], b = styles.boxes[i];
          assert.ok(a.x + a.width <= b.x + 1, "icon, label and trailing chevron remain in order");
          assert.ok(Math.abs(a.y + a.height / 2 - b.y - b.height / 2) < 1, "all parts stay on the same row");
        }
      };
      await checkRow();
      const wasOpen = await row.evaluate(el => el.parentElement.open);
      await row.focus();
      await page.keyboard.press("Enter");
      assert.equal(await row.evaluate(el => el.parentElement.open), !wasOpen);
      await checkRow();
      await page.keyboard.press("Space");
      assert.equal(await row.evaluate(el => el.parentElement.open), wasOpen);
    }
    const original = page.locator('.cx-turn-agent[data-post-number="3"] .original-details > summary');
    assert.equal(await original.evaluate(el => getComputedStyle(el).display), "list-item", "original post disclosures keep site styling");
    assert.equal(await original.evaluate(el => getComputedStyle(el, "::before").content), '"▸"');
    await original.click();
    assert.equal(await original.evaluate(el => el.parentElement.open), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.CODEX_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.CODEX_SCREENSHOT_DIR, { recursive: true });
      await rows[3].click();
      await tools.scrollIntoViewIfNeeded();
      await tools.evaluate(el => el.blur());
      await page.screenshot({ path: path.join(process.env.CODEX_SCREENSHOT_DIR, `disclosure-${mode}-${width}.png`) });
    }
  }
});

test("presentation: activity visibility alone never reports a post as read", async t => {
  const page = await openFixture(t, { route: "/t/client/42", random: 0, mockWrites: { "/topics/timings": {} } });
  await page.evaluate(() => Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }));
  await reply(page, "/t/42.json", conversation());
  await hasText(page, ".cx-thread-posts", "第 2 条原始回复");
  await page.setViewportSize({ width: 900, height: 480 });
  const turn = page.locator('.cx-turn-agent[data-post-number="2"]');
  await turn.locator(".cx-tools > summary").click();
  for (const summary of await turn.locator(".cx-runline > summary").all()) await summary.click();
  await turn.evaluate(el => {
    const scroller = el.closest(".cx-view-detail");
    scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  });
  assert.equal(await turn.evaluate(el => el.querySelector(".cx-cooked").getBoundingClientRect().top > el.closest(".cx-view-detail").getBoundingClientRect().bottom), true);
  await page.evaluate(() => Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }));
  await settle(page, 1200);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  assert.equal(await page.evaluate(() => __harness.requests.filter(r => r.url === "/topics/timings").length), 0);
  await turn.locator(".cx-cooked").evaluate(el => {
    const scroller = el.closest(".cx-view-detail");
    scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  });
  await settle(page, 1200);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const bodies = await page.evaluate(() => __harness.requests.filter(r => r.url === "/topics/timings").map(r => r.body));
  assert.ok(bodies.some(body => body.includes("timings[2]=")), "visible original reply is still tracked");
});

test("presentation: compact composer preserves formatting, IME, quote and exact mocked send payload", async t => {
  const page = await openThread(t, { mockWrites: { "/posts.json": { id: 425 } } });
  const input = page.locator(".cx-md-edit");
  assert.equal(await page.locator(".codex-composer-send").isDisabled(), true);
  assert.equal(await page.locator(".cx-composer-format-tools").isVisible(), false);
  await page.locator(".cx-format-toggle").click();
  assert.equal(await page.locator(".cx-composer-format-tools").isVisible(), true);
  await input.fill("中文回复");
  await input.press("Control+a");
  await page.locator('[data-tool="bold"]').click();
  await hasText(page, ".cx-md-edit", "中文回复");
  await input.dispatchEvent("keydown", { key: "Enter", isComposing: true });
  await settle(page);
  assert.equal(await page.evaluate(() => __harness.requests.filter(r => r.method === "POST").length), 0);
  await page.locator('.cx-act[data-action="reply"][data-post-number="2"]').click();
  await hasText(page, ".cx-compose-target", "#2");
  await page.locator('[data-tool="plus"]').click();
  await page.getByRole("button", { name: "引用整个帖子" }).click();
  await reply(page, "/posts/422.json", { username: "developer2", post_number: 2, raw: "真正的原始内容" });
  await hasText(page, ".cx-md-edit", "真正的原始内容");
  await page.locator('[data-tool="preview"]').click();
  await hasText(page, ".cx-compose-preview", "真正的原始内容");
  await page.locator(".codex-composer-send").click();
  await hasText(page, ".cx-composer-status", "已发送");
  const sent = await page.evaluate(() => JSON.parse(__harness.requests.find(r => r.url === "/posts.json").body));
  assert.deepEqual(sent, { raw: '**中文回复**[quote="developer2, post:2"]\n真正的原始内容\n[/quote]', topic_id: 42, reply_to_post_number: 2 });
  await reply(page, "/t/42.json", conversation());
  assert.equal(await page.locator(".codex-composer-send").isDisabled(), true);
  assert.equal(await page.locator(".cx-compose-target").isVisible(), false);
});

test("presentation: thread and expanded composer fit dark/light desktop and mobile layouts", async t => {
  for (const mode of ["dark", "light"]) for (const width of [1600, 1280, 900, 390]) {
    const page = await openThread(t, { rootClass: `${mode}-scheme`, width });
    const railColor = await page.locator(".codex-rail").evaluate(el => getComputedStyle(el).backgroundColor);
    const channels = railColor.match(/\d+/g).map(Number);
    assert.equal(channels[0], channels[1], "rail is neutral grey");
    assert.equal(channels[1], channels[2]);
    await page.locator(".cx-format-toggle").click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const bounds = await page.locator(".codex-composer").boundingBox();
    for (const button of await page.locator(".codex-composer button:visible").all()) {
      const box = await button.boundingBox();
      assert.ok(box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width + 1, "composer controls stay inside card");
    }
    await page.locator(".cx-format-toggle").click();
    await page.locator(".cx-format-toggle").evaluate(el => el.blur());
    if (process.env.CODEX_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.CODEX_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.CODEX_SCREENSHOT_DIR, `thread-${mode}-${width}.png`) });
      if (width === 1600 || width === 390) {
        await page.locator(".cx-tools > summary").first().click();
        await page.screenshot({ path: path.join(process.env.CODEX_SCREENSHOT_DIR, `thread-tools-${mode}-${width}.png`) });
        await page.locator(".cx-runline > summary").first().click();
        await page.screenshot({ path: path.join(process.env.CODEX_SCREENSHOT_DIR, `thread-command-${mode}-${width}.png`) });
      }
    }
  }
});
