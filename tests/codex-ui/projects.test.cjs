const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { CODE_PROJECTS, computeTextDiff, fileDiffHtml, tokenizeCode } = require("../../linuxdo-codex.user.js");

test("projects: five complete file sets preserve source text, matching paths and reproducible revisions", () => {
  assert.equal(CODE_PROJECTS.length, 5);
  assert.equal(new Set(CODE_PROJECTS.map(p => p.language)).size, 5);
  for (const project of CODE_PROJECTS) {
    assert.ok(project.files.length >= 3);
    assert.equal(new Set(project.files.map(f => f.path)).size, project.files.length);
    const main = project.files[0];
    assert.ok(main.content.split("\n").length >= 80 && main.content.split("\n").length <= 160, project.id);
    assert.ok(project.files.some(f => /test/i.test(f.path)), "project includes its own regression test");
    for (const file of project.files) {
      assert.doesNotMatch(file.path, /\.\.|linux-do|demo/i);
      assert.doesNotMatch(file.content, /演示环境|静态示例|TopicService|topic_id/);
      assert.equal(tokenizeCode(file.content, file.language).map(t => t.text).join(""), file.content);
      if (file.language !== "text") assert.ok(file.path.endsWith({ typescript: ".ts", python: ".py", go: ".go", rust: ".rs", java: ".java" }[file.language]));
    }
    const diff = computeTextDiff(main.before, main.content);
    assert.ok(diff.additions > 0 && diff.deletions > 0);
    assert.match(fileDiffHtml(main), new RegExp(`${diff.additions} additions · ${diff.deletions} deletions`));
    for (const hunk of diff.hunks) for (const line of hunk.lines) {
      if (line.kind !== "add") assert.equal(main.before.split("\n")[line.oldLineNo - 1], line.text);
      if (line.kind !== "del") assert.equal(main.content.split("\n")[line.newLineNo - 1], line.text);
    }
  }
});

function extract(project, t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-project-test-"));
  // Delete only the concrete temporary directory created by this test.
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of project.files) {
    const target = path.join(root, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
  }
  return root;
}

test("projects: TypeScript request client passes its bundled tests using mocked transport", t => {
  const root = extract(CODE_PROJECTS.find(p => p.id === "request-client"), t);
  const run = spawnSync(process.execPath, ["--test", "tests/client.test.ts"], { cwd: root, encoding: "utf8", timeout: 10000, windowsHide: true });
  assert.equal(run.status, 0, `${run.error || ""}\n${run.stdout}\n${run.stderr}`);
});

const python = process.env.CODEX_PYTHON_PATH || path.join(os.homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe");
test("projects: Python pipeline passes its bundled async regression tests", { skip: !fs.existsSync(python) }, t => {
  const root = extract(CODE_PROJECTS.find(p => p.id === "task-pipeline"), t);
  const run = spawnSync(python, ["-m", "unittest", "discover", "-s", "tests", "-v"], { cwd: root, encoding: "utf8", timeout: 10000, windowsHide: true });
  assert.equal(run.status, 0, `${run.error || ""}\n${run.stdout}\n${run.stderr}`);
});
