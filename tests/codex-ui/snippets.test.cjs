const test = require("node:test");
const assert = require("node:assert");

const codex = require("../../linuxdo-codex.user.js");

test("T06: extractThreadSnippets extracts snippets from posts with stable keys", () => {
  // Mock post containers
  const post1 = {
    dataset: { postNumber: "1", postId: "1001" },
    querySelectorAll: (sel) => {
      if (sel.includes("pre")) {
        return [
          {
            closest: (s) => (s.includes("quote") ? null : null),
            querySelector: (s) => ({
              textContent: 'console.log("hello");\nconst x = 10;',
              className: "lang-javascript"
            })
          }
        ];
      }
      return [];
    }
  };

  const post2 = {
    dataset: { postNumber: "2", postId: "1002" },
    querySelectorAll: (sel) => {
      if (sel.includes("pre")) {
        return [
          {
            closest: (s) => (s.includes("quote") ? null : null),
            querySelector: (s) => ({
              textContent: 'def foo():\n    return 42',
              className: "lang-python"
            })
          }
        ];
      }
      return [];
    }
  };

  const container = {
    querySelectorAll: (sel) => {
      if (sel.includes("cx-turn")) {
        return [post1, post2];
      }
      return [];
    }
  };

  const snippets = codex.extractThreadSnippets(container, 555);
  assert.strictEqual(snippets.length, 2);
  assert.strictEqual(snippets[0].id, "snippet-555-1-0");
  assert.strictEqual(snippets[0].postNumber, 1);
  assert.strictEqual(snippets[0].lang, "typescript"); // mapped js -> typescript
  assert.strictEqual(snippets[0].code, 'console.log("hello");\nconst x = 10;');

  assert.strictEqual(snippets[1].id, "snippet-555-2-0");
  assert.strictEqual(snippets[1].postNumber, 2);
  assert.strictEqual(snippets[1].lang, "python");
  assert.strictEqual(snippets[1].code, 'def foo():\n    return 42');
});

test("T06: extractThreadSnippets returns empty array for posts without code", () => {
  const postWithoutCode = {
    dataset: { postNumber: "1", postId: "1001" },
    querySelectorAll: () => []
  };
  const container = { querySelectorAll: () => [postWithoutCode] };
  const snippets = codex.extractThreadSnippets(container, 555);
  assert.strictEqual(snippets.length, 0);
});
