import type { SettingKey } from "./settings";

export const CONFIG_SETTING_KEYS: readonly SettingKey[] = [
  "warnBeforeQuitting", "warnBeforeClosingWindow", "restoreSession", "searchEngine", "searchSuggestions", "showSelectionSearch",
  "commandBarPreference", "tabLayout", "autoHideTabs", "sidebarSide", "hideToolbarWhileScrolling", "newTabPosition", "newTabButtonPosition", "appLinksFirst", "newTabOpens", "reuseEmptyNewTab",
  "warnBeforeClosingLastTab", "undoReopensClosedTab", "warnBeforeMovingTabsToProfile", "shareTabsAcrossWindows", "tabReorderHaptics",
  "extendWebsiteColor", "cmdClickCreatesTabGroup", "optShiftClickOpensInGroup", "dragToGroupInTopStrip", "peekModifier", "peekLinksToOtherSites", "newTabLinksOpenIn",
  "splitLinkModifier", "autoGroupMeetingTabs", "cleanUpInactiveTabsAfterMinutes", "suggestCleanUp", "mutedSites", "showUnreadCounts", "showTopAppBadges", "unreadHiddenSites", "neverTranslateSites",
  "autoPictureInPicture", "commandScrollZoom", "videoUpscaling", "sidebarMediaControls", "sidebarWidth", "showSidebarButton",
  "showClearButton", "tidyTabs", "balancedTopApps", "showAdvancedSettings", "selectedTabGlow", "interfaceStyle", "glassTintWithTheme",
  "glassTintAmount", "pageScrollBars", "fadeUnloadedTabs", "warnBeforeClosingTabGroup", "batterySaverWhen", "memorySaver",
  "memorySaverMode", "tabManagementMode", "loadProfilesWhenOpened", "keepActiveSites", "extensionSidePanelWidth", "showFullUrl", "showBookmarks", "bookmarksBar", "bookmarksBarSize",
  "hideBookmarksBarImport", "appearance", "addressBar", "compactToolbar", "borderlessMode", "pageFrame", "pageFrameZeroInFullScreen", "pageFrameZeroWhenTabsHidden", "commandBarPlacement", "spacesFollowAppearance", "adaptTextToColor",
  "profileSwitcherIcons", "shortcuts", "openLinksInLittleUniverse", "littleUniverseOpensNewTabLinks", "littleWindowGestures", "littleUniverseSize",
  "omniboxProviders", "launchActions", "commandBarStart",
  "showAIAssistant", "aiProvider", "aiModel", "ollamaEndpoint", "aiWebSearchEnabled", "aiWebSearchEngine", "aiWebSearchMaxResults",
  "aiWebSearchContextSize", "aiToolExecutionMode", "tabOrganizerEnabled",
  "startupLoadMode", "nestTabsFromLinks", "linkPreviews", "warnBeforeHTTP", "fingerprintingProtection", "removeTrackingFromLinks",
  "topBarAddressView", "themeTranslucency", "favoritePreviews", "archiveAfter", "searchPageTextInHistory",
  "developerModeEnabled", "developerSites", "sponsorBlockEnabled", "sponsorBlockCategories", "youTubeHideShorts", "enabledOptionalFilterLists",
];

export const CONFIG_EXCLUDED_KEYS: readonly SettingKey[] = [
  "customSearchUrl", "customSearchEngines", "extensionSearchEngines", "allowJavaScriptFromAppleEvents", "cliControl", "defaultProfileId",
  "pageEngine", "websiteEngines", "protectedVideoInWebKit", "browserControlServerEnabled",
];

const ALLOWED: ReadonlySet<string> = new Set(CONFIG_SETTING_KEYS);

export const isConfigSettingKey = (key: string): key is SettingKey => ALLOWED.has(key);
