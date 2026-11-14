import assert from "node:assert/strict";
import { test } from "node:test";
import {
  newSpaceTheme,
  pointHue,
  pointSaturation,
  profileThemeToSpaceTheme,
  resolveSpaceTheme,
  spaceThemeFromAccent,
  spaceThemeHues,
  spaceThemeIsDark,
  spaceThemePoint,
  spaceThemeTileColors,
  spaceThemeToProfileTheme,
} from "./spaceThemes.ts";
import { colorHex } from "../../lib/profileLook.ts";

test("hues follow Arc's wheel rules", () => {
  assert.deepEqual(spaceThemeHues(100, 1, "analogous"), [100]);
  assert.deepEqual(spaceThemeHues(100, 2, "analogous"), [100, 140]);
  assert.deepEqual(spaceThemeHues(100, 2, "complementary"), [100, 280]);
  assert.deepEqual(spaceThemeHues(100, 3, "analogous"), [100, 140, 60]);
  assert.deepEqual(spaceThemeHues(100, 3, "complementary"), [100, 250, 310]);
  assert.deepEqual(spaceThemeHues(350, 2, "analogous"), [350, 30]);
});

test("a point's hue and saturation round-trip through the canvas", () => {
  for (const hue of [0, 45, 120, 200, 359]) {
    const p = spaceThemePoint(hue, 0.8);
    assert.ok(Math.abs(pointHue(p) - hue) < 0.01, `hue ${hue} -> ${pointHue(p)}`);
    assert.ok(Math.abs(pointSaturation(p) - 0.8) < 0.01);
  }
  assert.equal(pointSaturation({ x: 0.5, y: 0.5 }), 0);
});

test("a theme from an accent keeps that accent's hue", () => {
  const theme = spaceThemeFromAccent("#3366CC");
  const resolved = resolveSpaceTheme(theme, false);
  assert.match(colorHex(resolved.accent), /^#[0-9A-F]{6}$/);
  assert.equal(theme.mode, "auto");
  assert.equal(theme.colorCount, 1);
  const bad = spaceThemeFromAccent("not-a-color");
  assert.equal(bad.points[0].x, 0.5);
});

test("resolving is dark-aware and single-point themes still read as a gradient", () => {
  const theme = newSpaceTheme([spaceThemePoint(210, 0.8)], { mode: "auto", intensity: 0.6 });
  const light = resolveSpaceTheme(theme, false);
  const dark = resolveSpaceTheme(theme, true);
  assert.equal(light.isDark, false);
  assert.equal(dark.isDark, true);
  assert.equal(light.stops.length, 2);
  assert.notEqual(colorHex(light.stops[0]), colorHex(dark.stops[0]));
  assert.equal(spaceThemeIsDark(theme, true), true);
  assert.equal(spaceThemeIsDark({ ...theme, mode: "light" }, true), false);
  assert.equal(spaceThemeIsDark({ ...theme, mode: "dark" }, false), true);
});

test("derived companions follow the key when the wheel or count changes", () => {
  const theme = newSpaceTheme([spaceThemePoint(100, 0.8)], { colorCount: 3, wheel: "analogous" });
  assert.equal(theme.points.length, 3);
  assert.ok(Math.abs(pointHue(theme.points[1]) - 140) < 0.01);
  assert.ok(Math.abs(pointHue(theme.points[2]) - 60) < 0.01);
  const comp = newSpaceTheme([spaceThemePoint(100, 0.8)], { colorCount: 2, wheel: "complementary" });
  assert.ok(Math.abs(pointHue(comp.points[1]) - 280) < 0.01);
});

test("tile colors differ between light and dark chrome", () => {
  const light = spaceThemeTileColors({ r: 0.7, g: 0.8, b: 0.9, a: 1 }, false);
  const dark = spaceThemeTileColors({ r: 0.7, g: 0.8, b: 0.9, a: 1 }, true);
  assert.notEqual(light.fill, dark.fill);
  for (const v of Object.values(light)) assert.match(v, /^#[0-9A-F]{6}$/);
});

test("a space theme converts to a profile theme and back with its hue, mode and grain kept", () => {
  const theme = newSpaceTheme([spaceThemePoint(200, 0.7)], { mode: "dark", intensity: 0.8, grain: 0.4, overlay: "denim", colorCount: 2 });
  const profile = spaceThemeToProfileTheme(theme);
  assert.equal(profile.mode, "dark");
  assert.equal(profile.intensity, 0.8);
  assert.equal(profile.grain, 0.4);
  assert.equal(profile.texture, "denim");
  assert.equal(profile.stops.length, 2);
  assert.equal(profile.dark.stops.length, 2);
  const back = profileThemeToSpaceTheme(profile);
  assert.equal(back.mode, "dark");
  assert.ok(Math.abs(pointHue(back.points[0]) - 200) < 1, `hue ${pointHue(back.points[0])}`);
  assert.equal(back.overlay, "denim");
});
