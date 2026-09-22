const test = require("node:test");
const assert = require("node:assert");

const codex = require("../../linuxdo-codex.user.js");

test("T06: computeTextDiff handles identical texts", () => {
  const text = "line1\nline2\nline3";
  const diff = codex.computeTextDiff(text, text);
  assert.strictEqual(diff.additions, 0);
  assert.strictEqual(diff.deletions, 0);
  assert.strictEqual(diff.isIdentical, true);
});

test("T06: computeTextDiff computes correct additions and deletions", () => {
  const before = "const a = 1;\nconst b = 2;\nconst c = 3;";
  const after = "const a = 1;\nconst b = 99;\nconst c = 3;\nconst d = 4;";

  const diff = codex.computeTextDiff(before, after);
  assert.strictEqual(diff.deletions, 1, "Should have 1 deletion");
  assert.strictEqual(diff.additions, 2, "Should have 2 additions");
  assert.ok(diff.hunks.length >= 1, "Should have at least 1 hunk");

  const firstHunk = diff.hunks[0];
  assert.ok(firstHunk.header.startsWith("@@ -"), `Hunk header format: ${firstHunk.header}`);

  // Check line numbers consistency:
  let curOld = firstHunk.oldStart;
  let curNew = firstHunk.newStart;
  let oldSeen = 0;
  let newSeen = 0;

  for (const row of firstHunk.lines) {
    if (row.kind === "del") {
      assert.strictEqual(row.oldLineNo, curOld++);
      oldSeen++;
    } else if (row.kind === "add") {
      assert.strictEqual(row.newLineNo, curNew++);
      newSeen++;
    } else if (row.kind === "context") {
      assert.strictEqual(row.oldLineNo, curOld++);
      assert.strictEqual(row.newLineNo, curNew++);
      oldSeen++;
      newSeen++;
    }
  }

  assert.strictEqual(oldSeen, firstHunk.oldCount);
  assert.strictEqual(newSeen, firstHunk.newCount);
});

test("T06: computeTextDiff handles file header and boundary changes", () => {
  const before = "first\nmiddle\nlast";
  const after = "newFirst\nmiddle\nnewLast";
  const diff = codex.computeTextDiff(before, after);
  assert.strictEqual(diff.additions, 2);
  assert.strictEqual(diff.deletions, 2);
});
