const test = require("node:test");
const assert = require("node:assert");

const codex = require("../../linuxdo-codex.user.js");

test("T08: isEditableTarget identifies input, textarea and contenteditable elements", () => {
  // Mock element objects
  const inputEl = { tagName: "INPUT", nodeType: 1 };
  const textareaEl = { tagName: "TEXTAREA", nodeType: 1 };
  const selectEl = { tagName: "SELECT", nodeType: 1 };
  const divEl = { tagName: "DIV", nodeType: 1, isContentEditable: false, closest: () => null };
  const editableDiv = { tagName: "DIV", nodeType: 1, isContentEditable: true, closest: () => null };
  const childOfEditor = {
    tagName: "SPAN",
    nodeType: 1,
    isContentEditable: false,
    closest: (sel) => (sel.includes("contenteditable") || sel.includes("d-editor-input") ? {} : null)
  };

  assert.strictEqual(codex.isEditableTarget(inputEl), true);
  assert.strictEqual(codex.isEditableTarget(textareaEl), true);
  assert.strictEqual(codex.isEditableTarget(selectEl), true);
  assert.strictEqual(codex.isEditableTarget(editableDiv), true);
  assert.strictEqual(codex.isEditableTarget(childOfEditor), true);
  assert.strictEqual(codex.isEditableTarget(divEl), false);
});

test("T08: shouldHandleKeyboardShortcut respects IME composition and editable elements", () => {
  // Normal body keydown
  const normalEvent = {
    key: "k",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    keyCode: 75,
    target: { tagName: "BODY", nodeType: 1, closest: () => null }
  };
  assert.strictEqual(codex.shouldHandleKeyboardShortcut(normalEvent, "k"), true);

  // During IME composition (e.g. Chinese input)
  const imeEvent1 = { ...normalEvent, isComposing: true };
  assert.strictEqual(codex.shouldHandleKeyboardShortcut(imeEvent1, "k"), false);

  const imeEvent2 = { ...normalEvent, keyCode: 229 };
  assert.strictEqual(codex.shouldHandleKeyboardShortcut(imeEvent2, "k"), false);

  // Inside textarea / input
  const inputEvent = { ...normalEvent, target: { tagName: "TEXTAREA", nodeType: 1 } };
  assert.strictEqual(codex.shouldHandleKeyboardShortcut(inputEvent, "k"), false);

  // Inside contenteditable
  const editableEvent = {
    ...normalEvent,
    target: { tagName: "DIV", nodeType: 1, isContentEditable: true, closest: () => null }
  };
  assert.strictEqual(codex.shouldHandleKeyboardShortcut(editableEvent, "k"), false);
});
