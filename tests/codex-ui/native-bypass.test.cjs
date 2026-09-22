const test = require("node:test");
const assert = require("node:assert");

const codex = require("../../linuxdo-codex.user.js");

test("T03: buildNativeUrl retains pathname, hash, and existing query params", () => {
  const cases = [
    {
      input: "https://linux.do/t/topic-slug/123",
      expected: "https://linux.do/t/topic-slug/123?cx_native=1"
    },
    {
      input: "https://linux.do/t/topic-slug/123?page=2#post-5",
      expected: "https://linux.do/t/topic-slug/123?page=2&cx_native=1#post-5"
    },
    {
      input: "https://linux.do/c/dev/1?order=views",
      expected: "https://linux.do/c/dev/1?order=views&cx_native=1"
    }
  ];

  for (const c of cases) {
    const res = codex.buildNativeUrl(c.input);
    const url = new URL(res);
    assert.strictEqual(url.searchParams.get("cx_native"), "1");
    if (c.input.includes("page=2")) {
      assert.strictEqual(url.searchParams.get("page"), "2");
    }
    if (c.input.includes("#post-5")) {
      assert.strictEqual(url.hash, "#post-5");
    }
  }
});

test("T03: shouldBypassTheme detects native query param and session flag", () => {
  // Test with query param
  const bypass1 = codex.shouldBypassTheme({
    search: "?cx_native=1",
    sessionStorage: { getItem: () => null, setItem: () => {} }
  });
  assert.strictEqual(bypass1, true);

  // Test with session flag
  const bypass2 = codex.shouldBypassTheme({
    search: "",
    sessionStorage: { getItem: (k) => (k === "codex_native_mode" ? "1" : null), setItem: () => {} }
  });
  assert.strictEqual(bypass2, true);

  // Test normal mode
  const bypass3 = codex.shouldBypassTheme({
    search: "",
    sessionStorage: { getItem: () => null, setItem: () => {} }
  });
  assert.strictEqual(bypass3, false);
});
