import assert from "node:assert/strict";
import { test } from "node:test";
const {
  DEFAULT_SETTINGS,
  SETTING_SPECS,
  archiveAfterMs,
  choose,
  isDeveloperSite,
  parseSettings,
  protectionApplies,
  sponsorBlockSkipOption,
  tabUnloadTimeoutSeconds,
} = await import("./settings.ts");

const base = () => ({ settings: { ...DEFAULT_SETTINGS }, settingsMeta: { chosen: [], inferred: [] } });

test("the Nook settings arrive with Nook defaults", () => {
  assert.equal(DEFAULT_SETTINGS.tabManagementMode, "standard");
  assert.equal(DEFAULT_SETTINGS.startupLoadMode, "favoritesAndSpace");
  assert.equal(DEFAULT_SETTINGS.nestTabsFromLinks, true);
  assert.equal(DEFAULT_SETTINGS.linkPreviews, false);
  assert.equal(DEFAULT_SETTINGS.warnBeforeHTTP, false);
  assert.equal(DEFAULT_SETTINGS.fingerprintingProtection, "privateWindows");
  assert.equal(DEFAULT_SETTINGS.removeTrackingFromLinks, "privateWindows");
  assert.equal(DEFAULT_SETTINGS.topBarAddressView, false);
  assert.equal(DEFAULT_SETTINGS.themeTranslucency, false);
  assert.equal(DEFAULT_SETTINGS.favoritePreviews, true);
  assert.equal(DEFAULT_SETTINGS.archiveAfter, 12);
  assert.equal(DEFAULT_SETTINGS.searchPageTextInHistory, true);
  assert.equal(DEFAULT_SETTINGS.tabOrganizerEnabled, false);
  assert.equal(DEFAULT_SETTINGS.showAIAssistant, true);
  assert.equal(DEFAULT_SETTINGS.aiProvider, "gemini");
  assert.equal(DEFAULT_SETTINGS.aiModel, "");
  assert.equal(DEFAULT_SETTINGS.ollamaEndpoint, "http://localhost:11434");
  assert.equal(DEFAULT_SETTINGS.aiWebSearchEnabled, false);
  assert.equal(DEFAULT_SETTINGS.aiWebSearchEngine, "auto");
  assert.equal(DEFAULT_SETTINGS.aiWebSearchMaxResults, 5);
  assert.equal(DEFAULT_SETTINGS.aiWebSearchContextSize, "medium");
  assert.equal(DEFAULT_SETTINGS.aiToolExecutionMode, "ask");
  assert.equal(DEFAULT_SETTINGS.browserControlServerEnabled, false);
  assert.equal(DEFAULT_SETTINGS.developerModeEnabled, false);
  assert.deepEqual(DEFAULT_SETTINGS.developerSites, []);
  assert.equal(DEFAULT_SETTINGS.sponsorBlockEnabled, false);
  assert.equal(DEFAULT_SETTINGS.youTubeHideShorts, false);
  assert.deepEqual(DEFAULT_SETTINGS.enabledOptionalFilterLists, ["ublock-annoyances-cookies.txt"]);
});

test("tab unload timeouts follow the management mode and a wrong value falls back to standard", () => {
  assert.equal(tabUnloadTimeoutSeconds({ tabManagementMode: "powerSaving" }), 300);
  assert.equal(tabUnloadTimeoutSeconds({ tabManagementMode: "standard" }), 1800);
  assert.equal(tabUnloadTimeoutSeconds({ tabManagementMode: "performance" }), 14400);
  assert.equal(parseSettings({ tabManagementMode: "turbo" }).tabManagementMode, "standard");
  assert.equal(parseSettings({ archiveAfter: -1 }).archiveAfter, 12);
  assert.equal(parseSettings({ archiveAfter: 0 }).archiveAfter, 0);
  assert.equal(parseSettings({ archiveAfter: 721 }).archiveAfter, 12);
});

test("archiveAfter of zero means never and otherwise converts hours to milliseconds", () => {
  assert.equal(archiveAfterMs({ archiveAfter: 0 }), null);
  assert.equal(archiveAfterMs({ archiveAfter: 12 }), 12 * 3_600_000);
  assert.equal(archiveAfterMs({ archiveAfter: 1 }), 3_600_000);
});

test("a protection scope applies off never, in private windows only, or everywhere", () => {
  assert.equal(protectionApplies("off", false), false);
  assert.equal(protectionApplies("off", true), false);
  assert.equal(protectionApplies("privateWindows", false), false);
  assert.equal(protectionApplies("privateWindows", true), true);
  assert.equal(protectionApplies("allWindows", false), true);
  assert.equal(protectionApplies("allWindows", true), true);
});

test("SponsorBlock skips sponsors automatically, highlights manually, and everything else stays off", () => {
  assert.equal(sponsorBlockSkipOption(DEFAULT_SETTINGS, "sponsor"), "auto");
  assert.equal(sponsorBlockSkipOption(DEFAULT_SETTINGS, "poi_highlight"), "manual");
  assert.equal(sponsorBlockSkipOption(DEFAULT_SETTINGS, "intro"), "disabled");
  assert.equal(sponsorBlockSkipOption(DEFAULT_SETTINGS, "selfpromo"), "disabled");
  const changed = choose(base(), { sponsorBlockCategories: { sponsor: "manual" } });
  assert.equal(sponsorBlockSkipOption(changed.settings, "sponsor"), "manual");
  assert.equal(sponsorBlockSkipOption(changed.settings, "intro"), "disabled");
});

test("developer sites match case-insensitively and the top layout forces the top address view", () => {
  assert.equal(isDeveloperSite({ developerSites: ["Example.com"] }, "example.com"), true);
  assert.equal(isDeveloperSite({ developerSites: ["Example.com"] }, "other.com"), false);
  assert.equal(isDeveloperSite({ developerSites: [] }, null), false);
  const top = choose(base(), { tabLayout: "top" });
  assert.equal(top.settings.topBarAddressView, true);
  const explicit = choose(base(), { tabLayout: "top", topBarAddressView: false });
  assert.equal(explicit.settings.topBarAddressView, false);
});

test("every new default passes its own check", () => {
  for (const key of [
    "tabManagementMode",
    "startupLoadMode",
    "nestTabsFromLinks",
    "linkPreviews",
    "warnBeforeHTTP",
    "fingerprintingProtection",
    "removeTrackingFromLinks",
    "topBarAddressView",
    "themeTranslucency",
    "favoritePreviews",
    "archiveAfter",
    "searchPageTextInHistory",
    "tabOrganizerEnabled",
    "developerModeEnabled",
    "developerSites",
    "sponsorBlockEnabled",
    "sponsorBlockCategories",
    "youTubeHideShorts",
    "enabledOptionalFilterLists",
  ]) {
    assert.ok(SETTING_SPECS[key].valid(DEFAULT_SETTINGS[key]), key);
  }
});
