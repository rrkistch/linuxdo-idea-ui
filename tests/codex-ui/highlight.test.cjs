const test = require("node:test");
const assert = require("node:assert");

// We'll test against the exported functions from linuxdo-codex.user.js
const codex = require("../../linuxdo-codex.user.js");

test("T01: tokenizeCode preserves exact text", () => {
  const inputs = [
    'const msg = "hello";',
    'const url = "https://example.com/a?x=1";',
    'const quoted = "say \\"hello\\"";',
    'const n = 42; // trailing comment',
    'value = "# this is not a Python comment"',
    'const markup = "<button>example</button>";',
    'let a = 0x1a_bf; let b = 3.14159; let c = 1e-4;',
    '/* multi-line\n   comment */\nconst x = `template ${value}`;',
    '// 中文注释包含特殊符号：<>&"\'\r\n\t  ',
    ""
  ];

  for (const input of inputs) {
    const tokens = codex.tokenizeCode(input, "typescript");
    const reconstructed = tokens.map(t => t.text).join("");
    assert.strictEqual(reconstructed, input, `Failed text preservation for: ${input}`);
  }
});

test("T01: highlightCode textContent matches input exactly (DOM simulation)", () => {
  const inputs = [
    'const msg = "hello";',
    'const url = "https://example.com/a?x=1";',
    'const quoted = "say \\"hello\\"";',
    'const n = 42; // trailing comment',
    'value = "# this is not a Python comment"',
    'const markup = "<button>example</button>";',
    '空行\n\n\t制表符\t中文注释 // 测试\r\nCRLF'
  ];

  for (const input of inputs) {
    const html = codex.highlightCode(input, "typescript");
    // decode HTML entities and strip tags to get textContent
    const textContent = html
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // normalize CRLF to compare
    assert.strictEqual(textContent, input, `textContent did not match input for: ${input}`);
    // Ensure no leaked internal placeholders
    assert.doesNotMatch(html, /\u0001|\u0002/, "Found leaked internal placeholders!");
  }
});

test("T01: URL '//' is not treated as comment and Python '#' in string is not comment", () => {
  const tsCode = 'const url = "https://example.com/a?x=1";';
  const tsTokens = codex.tokenizeCode(tsCode, "typescript");
  const tsComment = tsTokens.find(t => t.type === "comment");
  assert.strictEqual(tsComment, undefined, "URL // should not be tokenized as comment");

  const pyCode = 'value = "# this is not a Python comment"';
  const pyTokens = codex.tokenizeCode(pyCode, "python");
  const pyComment = pyTokens.find(t => t.type === "comment");
  assert.strictEqual(pyComment, undefined, "String # should not be tokenized as comment");
  const pyString = pyTokens.find(t => t.type === "string");
  assert.strictEqual(pyString?.text, '"# this is not a Python comment"');
});

test("T01: Real trailing comments and numbers are correctly tokenized", () => {
  const code = 'const n = 42; // trailing comment';
  const tokens = codex.tokenizeCode(code, "typescript");
  const numToken = tokens.find(t => t.type === "number");
  const commentToken = tokens.find(t => t.type === "comment");
  assert.strictEqual(numToken?.text, "42");
  assert.strictEqual(commentToken?.text, "// trailing comment");
});
