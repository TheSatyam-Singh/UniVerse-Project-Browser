import assert from "node:assert/strict";
import { test } from "node:test";

const { UNIVERSE_THEMES, universeThemeById } = await import("./universeThemes.ts");
const { themeAccent } = await import("../../lib/profileLook.ts");

function validColor(color) {
  if (!color || typeof color !== "object") return false;
  const c = color;
  return [c.r, c.g, c.b, c.a].every((v) => typeof v === "number" && v >= 0 && v <= 1);
}

test("UniVerse theme presets are well formed", () => {
  assert.ok(UNIVERSE_THEMES.length >= 3, "expected at least three presets");
  const ids = new Set();
  for (const preset of UNIVERSE_THEMES) {
    assert.ok(preset.id.length > 0);
    assert.ok(!ids.has(preset.id), `duplicate preset id ${preset.id}`);
    ids.add(preset.id);
    assert.ok(preset.name.length > 0);
    assert.equal(preset.theme.mode, "auto");
    assert.ok(preset.theme.stops.length >= 2 && preset.theme.stops.length <= 3);
    for (const stop of preset.theme.stops) {
      assert.ok(validColor(stop.color), `bad stop color in ${preset.id}`);
      assert.ok(stop.x >= 0 && stop.x <= 1 && stop.y >= 0 && stop.y <= 1);
    }
    assert.ok(preset.theme.dark, `preset ${preset.id} needs a dark look`);
    assert.ok(preset.theme.dark.stops.length >= 2);
    for (const stop of preset.theme.dark.stops) assert.ok(validColor(stop.color));
    const accent = themeAccent(preset.theme);
    assert.match(accent, /^#[0-9a-fA-F]{6}$/);
  }
});

test("universeThemeById finds presets by id", () => {
  assert.equal(universeThemeById("universe-indigo")?.name, "UniVerse Indigo");
  assert.equal(universeThemeById("nope"), undefined);
});
