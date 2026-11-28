import assert from "node:assert/strict";
import { test } from "node:test";
const { useBrowser } = await import("../browser/store.ts");
const { useTranslate, isAlwaysTranslated, setAlwaysTranslate } = await import("./translate.ts");

const S = () => useBrowser.getState();

const setup = (url = "https://fr.example/a", kind) => {
  S().hydrate({});
  const w = S().createWindow({ url, ...(kind ? { kind } : {}) });
  return S().windows[w].tabIds[0];
};
const detect = (tab, source) => useTranslate.setState({ [tab]: { status: "idle", source } });

test("turning on Always Translate stores the page's language for the profile, and turning it off removes it", () => {
  const tab = setup();
  detect(tab, "fr");
  assert.equal(isAlwaysTranslated("default", "fr"), false);
  setAlwaysTranslate(tab, true);
  assert.equal(isAlwaysTranslated("default", "fr"), true);
  assert.deepEqual(S().settings.alwaysTranslateLanguages, { default: ["fr"] });
  setAlwaysTranslate(tab, false);
  assert.equal(isAlwaysTranslated("default", "fr"), false);
  assert.deepEqual(S().settings.alwaysTranslateLanguages, { default: [] });
});

test("a regional variant maps to its base language, so zh-TW always translates as zh-Hant", () => {
  const tab = setup();
  detect(tab, "zh-TW");
  setAlwaysTranslate(tab, true);
  assert.deepEqual(S().settings.alwaysTranslateLanguages, { default: ["zh-Hant"] });
  assert.equal(isAlwaysTranslated("default", "zh-Hant"), true);
  assert.equal(isAlwaysTranslated("default", "zh-TW"), true);
  assert.equal(isAlwaysTranslated("default", "zh-Hans"), false);
});

test("an incognito tab never records the language", () => {
  const tab = setup("https://fr.example/a", "private");
  detect(tab, "fr");
  setAlwaysTranslate(tab, true);
  assert.equal(isAlwaysTranslated("default", "fr"), false);
  assert.deepEqual(S().settings.alwaysTranslateLanguages, {});
});

test("a tab with no detected language records nothing", () => {
  const tab = setup();
  setAlwaysTranslate(tab, true);
  assert.deepEqual(S().settings.alwaysTranslateLanguages, {});
});
