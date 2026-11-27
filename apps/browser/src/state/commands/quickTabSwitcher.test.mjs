import assert from "node:assert/strict";
import { test } from "node:test";
const { COMMANDS } = await import("./commandCatalog.ts");
const { menuShortcut, shortcutHint } = await import("./commandShortcuts.ts");

const state = (shortcuts, profileOrder = ["work", "home"]) => ({ settings: { shortcuts }, profileOrder });

test("Quick Tab Switcher is a window command on ⌘K", () => {
  const spec = COMMANDS.quickTabSwitcher;
  assert.equal(spec.title, "Quick Tab Switcher…");
  assert.deepEqual(spec.keys, ["⌘K"]);
  assert.equal(spec.scope, "window");
  assert.equal(spec.littleUniverse, "off");
  assert.equal(shortcutHint("quickTabSwitcher", state({})), "⌘K");
  assert.deepEqual(menuShortcut("quickTabSwitcher", state({})), { key: "k", modifiers: ["command"] });
});

test("a rebind moves the hint, and losing ⌘K to another command drops it", () => {
  assert.equal(shortcutHint("quickTabSwitcher", state({ quickTabSwitcher: ["j", "command"] })), "⌘J");
  assert.equal(shortcutHint("quickTabSwitcher", state({ closeTab: ["k", "command"] })), undefined);
});
