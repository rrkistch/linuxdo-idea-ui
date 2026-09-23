const test = require("node:test");
const assert = require("node:assert");

const codex = require("../../linuxdo-codex.user.js");

test("T09: sanitizeWidth clamps and handles invalid inputs", () => {
  const min = 200;
  const max = 500;
  const def = 300;

  assert.strictEqual(codex.sanitizeWidth(350, def, min, max), 350);
  assert.strictEqual(codex.sanitizeWidth(100, def, min, max), 200, "Too small should clamp to min");
  assert.strictEqual(codex.sanitizeWidth(900, def, min, max), 500, "Too large should clamp to max");
  assert.strictEqual(codex.sanitizeWidth(NaN, def, min, max), def, "NaN should fallback to default");
  assert.strictEqual(codex.sanitizeWidth("invalid", def, min, max), def, "Non-number should fallback to default");
  assert.strictEqual(codex.sanitizeWidth(null, def, min, max), def, "null should fallback to default");
});

test("T09: presentation defaults enable activity and preserve explicit opt-outs", () => {
  for (const raw of [null, "{invalid-json", "null", "{}"]) {
    const prefs = codex.readPresentationPrefs({ getItem: () => raw });
    assert.deepStrictEqual(prefs, { showThinking: true, showRunlines: true, demoMode: false });
  }
  assert.deepStrictEqual(codex.readPresentationPrefs({ getItem: () => '{"showThinking":false,"showRunlines":false}' }),
    { showThinking: false, showRunlines: false, demoMode: false });
});

test("T07: Category display aliases are independent and do not mutate original object", () => {
  const cat = { id: 42, name: "开发调优", slug: "dev" };
  const aliases = { "42": "My Dev Project" };

  const displayName = codex.getCategoryDisplayName(cat, aliases);
  assert.strictEqual(displayName, "My Dev Project");
  assert.strictEqual(cat.name, "开发调优", "Original category name must not be mutated");
  assert.strictEqual(cat.slug, "dev", "Original category slug must not be mutated");

  const unaliased = codex.getCategoryDisplayName({ id: 99, name: "运营", slug: "ops" }, aliases);
  assert.strictEqual(unaliased, "运营");
});

test("T07: sessionsForCat does not pad with fake mock sessions", () => {
  const cat = { id: 1, name: "常规", slug: "general" };
  const realTopics = [
    { id: 101, category_id: 1, title: "Topic 1", slug: "topic-1" }
  ];

  const sessions = codex.sessionsForCat(cat, 0, realTopics);
  assert.strictEqual(sessions.length, 1, "Should only contain real topic, no mock padding");
  assert.strictEqual(sessions[0].label, "Topic 1");
  assert.strictEqual(sessions[0].href, "/t/topic-1/101");
});
