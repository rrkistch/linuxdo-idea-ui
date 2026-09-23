// Run with Node's test runner and Playwright on NODE_PATH (or locally installed).
// CODEX_BROWSER_PATH optionally selects a local Chromium executable.
// The unmodified userscript executes at document-start; no exports/test mode are used.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const source = fs.readFileSync(path.join(__dirname, "../../linuxdo-codex.user.js"), "utf8");
let browser;
before(async () => {
  const executablePath = process.env.CODEX_BROWSER_PATH || [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(p => fs.existsSync(p));
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
});
after(async () => { await browser?.close(); });

function installHarness(options) {
  const h = window.__harness = { requests: [], frames: 0, rootWrites: 0, styles: 0, observers: 0 };
  if (options.random !== undefined) Math.random = () => options.random;
  if (options.nativeSession) sessionStorage.setItem("codex_native_mode", "1");
  if (options.presentationPrefs) localStorage.setItem("linuxdo-codex-presentation-prefs", JSON.stringify(options.presentationPrefs));
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => raf(time => { h.frames++; callback(time); });
  for (const method of ["add", "remove", "toggle"]) {
    const original = DOMTokenList.prototype[method];
    DOMTokenList.prototype[method] = function (...args) {
      if (this === document.documentElement?.classList) h.rootWrites++;
      return original.apply(this, args);
    };
  }
  for (const method of ["appendChild", "insertBefore"]) {
    const original = Node.prototype[method];
    Node.prototype[method] = function (node, ...args) {
      if (node.id === "linuxdo-codex-theme") h.styles++;
      return original.call(this, node, ...args);
    };
  }
  const observe = MutationObserver.prototype.observe;
  MutationObserver.prototype.observe = function (...args) {
    // Playwright's own selectors may create observers; count only userscript callers.
    if (new Error().stack.split("\n").slice(2).some(line => line.includes("codex-startup.user.js"))) h.observers++;
    return observe.apply(this, args);
  };
  // Every fetch is local. Even aborted requests can resolve, exercising version/owner
  // guards independently of transport cancellation (including stale finally blocks).
  window.fetch = (input, init = {}) => {
    const url = new URL(String(input), location.href);
    const entry = { url: url.pathname + url.search, method: init.method || "GET", body: init.body, aborted: false, done: false };
    h.requests.push(entry);
    return new Promise((resolve, reject) => {
      entry.reply = (data, status = 200) => {
        entry.done = true;
        resolve(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
      };
      init.signal?.addEventListener("abort", () => {
        entry.aborted = true;
        if (options.honorAbort) { entry.done = true; reject(new DOMException("Aborted", "AbortError")); }
      }, { once: true });
      if (entry.url === "/categories.json") entry.reply({ category_list: { categories: [] } });
      // Existing rail recents request is independent of the main list coordinator.
      if (entry.url === "/latest.json" && !init.signal) entry.reply({ topic_list: { topics: [] } });
      if (entry.method !== "GET") entry.reply(options.mockWrites?.[entry.url] || {});
    });
  };
}

async function openFixture(t, options = {}) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  if (options.width) await page.setViewportSize({ width: options.width, height: 1000 });
  page.setDefaultTimeout(1800);
  const errors = [];
  const network = [];
  page.on("pageerror", error => errors.push(error.message));
  // No real site, account, CDN, or API is contacted, including unmocked resources.
  await context.route("**/*", route => {
    if (route.request().isNavigationRequest()) {
      return route.fulfill({ contentType: "text/html", body: `<!doctype html><html class="${options.rootClass || ""}"><head><title>${options.challenge ? "Just a moment..." : "Linux DO fixture"}</title><link rel="icon" href="/favicon.ico"></head><body><aside class="sidebar-wrapper">Native sidebar</aside><div id="main-outlet-wrapper"><div id="main-outlet"><div class="community-banner">Community banner</div>Native content</div></div>${options.challenge ? '<form id="challenge-form"></form>' : ""}</body></html>` });
    }
    network.push(route.request().url());
    return route.fulfill({ status: 200, body: "" });
  });
  await context.addInitScript({ content: `(${installHarness.toString()})(${JSON.stringify(options)});\n${source}\n//# sourceURL=codex-startup.user.js` });
  t.after(async () => {
    const writes = await page.evaluate(() => window.__harness.requests.filter(r => r.method !== "GET").map(r => r.url));
    await context.close();
    assert.deepEqual(errors, [], "no uncaught browser errors");
    assert.deepEqual(writes.filter(url => !Object.hasOwn(options.mockWrites || {}, url)), [], "only explicitly mocked writes are allowed");
    assert.ok(network.every(url => new URL(url).pathname === "/favicon.ico"), `unexpected resource requests: ${network}`);
  });
  await page.goto(`https://linux.do${options.route || "/new"}`);
  return page;
}

const list = (title, id = 1, more = null) => ({ topic_list: { topics: title ? [{ id, title, slug: `topic-${id}`, posts_count: 1 }] : [], more_topics_url: more } });
const topic = (title, id = 42) => ({ id, title, slug: `topic-${id}`, posts_count: 1, post_stream: { stream: [id * 10], posts: [{ id: id * 10, post_number: 1, username: "fixture", cooked: `<p>${title} body</p>` }] } });
async function requestCount(page, url) { return page.evaluate(url => __harness.requests.filter(r => r.url === url).length, url); }
async function waitRequest(page, url, count = 1) { await page.waitForFunction(({ url, count }) => __harness.requests.filter(r => r.url === url).length >= count, { url, count }); }
async function reply(page, url, data, status = 200, index = -1) {
  await page.waitForFunction(({ url, index }) => !!__harness.requests.filter(r => r.url === url && !r.done).at(index), { url, index });
  await page.evaluate(({ url, data, status, index }) => {
    const matches = __harness.requests.filter(r => r.url === url && !r.done);
    const entry = matches.at(index);
    if (!entry) throw new Error(`No pending mock for ${url}`);
    entry.reply(data, status);
  }, { url, data, status, index });
}
async function hasText(page, selector, text) {
  await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text), { selector, text });
}
async function navigate(page, route) { await page.evaluate(route => history.pushState({}, "", route), route); }
async function scrollList(page) {
  await page.locator(".cx-view-list").evaluate(el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event("scroll")); });
}
async function settle(page, ms = 200) { await page.waitForTimeout(ms); }
async function assertNative(page) {
  assert.equal(await page.locator("#linuxdo-codex-theme, .codex-main, .codex-rail").count(), 0);
  assert.equal(await page.locator("html").evaluate(el => el.classList.contains("codex-theme") || el.classList.contains("codex-locked")), false);
  assert.equal(await page.locator("#main-outlet").isVisible(), true);
}

module.exports = { test, assert, openFixture, list, topic, requestCount, waitRequest, reply, hasText, navigate, scrollList, settle, assertNative };
