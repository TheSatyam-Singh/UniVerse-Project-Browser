import { isProviderEntryList, type CustomSearchEngine, type ExtensionSearchEngine, type ProviderEntry } from "@universe/core";
import { COMMAND_BAR_START_SCHEMA, isCommandBarStart, type CommandBarStart } from "../omnibox/commandBarStart";
import { isFields, isString, isStringList } from "../../lib/decode";
import type { JsonSchema } from "../../lib/jsonSchema";
import { PROVIDERS_SCHEMA } from "../omnibox/providerSchema";
import { DEFAULT_SIDEBAR_WIDTH, PAGE_FRAME, validPageFrame } from "../../lib/windowLayout";

export const DEFAULT_PROFILE_ID = "default";

export type SettingSpec<T> = { default: T; valid: (value: unknown) => boolean; synced: boolean; schema: JsonSchema; values?: readonly T[] };

const SYNCED = true;

const isRecordOf = (v: unknown, item: (x: unknown) => boolean) => isFields(v) && Object.values(v).every(item);
const isWidth = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;
const hasStrings = (v: unknown, keys: readonly string[]) => isFields(v) && keys.every((k) => isString(v[k]));

const STRING_LIST: JsonSchema = { type: "array", items: { type: "string" } };
const WIDTH: JsonSchema = { type: "number", exclusiveMinimum: 0 };
const engineRecords = (keys: string[]): JsonSchema => ({
  type: "array",
  items: { type: "object", properties: Object.fromEntries(keys.map((k) => [k, { type: "string" }])), required: keys },
});
const recordOf = (item: JsonSchema): JsonSchema => ({ type: "object", additionalProperties: item });

const flag = (d: boolean, synced = false): SettingSpec<boolean> => ({ default: d, valid: (v) => typeof v === "boolean", synced, schema: { type: "boolean" } });
const text = (d: string, synced = false): SettingSpec<string> => ({ default: d, valid: isString, synced, schema: { type: "string" } });
const width = (d: number): SettingSpec<number> => ({ default: d, valid: isWidth, synced: false, schema: WIDTH });
const fraction = (d: number, synced = false): SettingSpec<number> => ({
  default: d,
  valid: (v) => typeof v === "number" && v >= 0 && v <= 1,
  synced,
  schema: { type: "number", minimum: 0, maximum: 1 },
});
const oneOf = <const V extends readonly string[]>(values: V, d: V[number], synced = false): SettingSpec<V[number]> & { values: V } => ({
  default: d,
  values,
  valid: (v) => values.includes(v as string),
  synced,
  schema: { type: "string", enum: values },
});
const shaped = <T,>(d: T, valid: (v: unknown) => boolean, schema: JsonSchema, synced = false): SettingSpec<T> => ({ default: d, valid, synced, schema });

export const SPONSOR_BLOCK_CATEGORIES = ["sponsor", "selfpromo", "exclusive_access", "interaction", "intro", "outro", "preview", "filler", "music_offtopic", "poi_highlight"] as const;
export type SponsorBlockCategory = (typeof SPONSOR_BLOCK_CATEGORIES)[number];
export type SponsorBlockSkipOption = "auto" | "manual" | "disabled";
export const SPONSOR_BLOCK_CATEGORY_SKIP: Record<SponsorBlockCategory, SponsorBlockSkipOption> = {
  sponsor: "auto",
  selfpromo: "disabled",
  exclusive_access: "disabled",
  interaction: "disabled",
  intro: "disabled",
  outro: "disabled",
  preview: "disabled",
  filler: "disabled",
  music_offtopic: "disabled",
  poi_highlight: "manual",
};
export const DEFAULT_SPONSOR_BLOCK_CATEGORIES: Record<string, string> = { ...SPONSOR_BLOCK_CATEGORY_SKIP };

export const SETTING_SPECS = {
  warnBeforeQuitting: flag(false, SYNCED),
  warnBeforeClosingWindow: flag(true, SYNCED),
  restoreSession: flag(true),
  searchEngine: text("google", SYNCED),
  customSearchUrl: text("", SYNCED),
  customSearchEngines: shaped<CustomSearchEngine[]>([], (v) => Array.isArray(v) && v.every((e) => hasStrings(e, ["id", "name", "keyword", "url"])), engineRecords(["id", "name", "keyword", "url"]), SYNCED),
  extensionSearchEngines: shaped<ExtensionSearchEngine[]>(
    [],
    (v) => Array.isArray(v) && v.every((e) => hasStrings(e, ["profile", "extensionId", "name", "keyword", "url"])),
    engineRecords(["profile", "extensionId", "name", "keyword", "url"]),
  ),
  searchSuggestions: flag(true, SYNCED),
  showSelectionSearch: flag(true, SYNCED),
  tabManagementMode: oneOf(["powerSaving", "standard", "performance"], "standard", SYNCED),
  startupLoadMode: oneOf(["nothing", "favorites", "favoritesAndSpace"], "favoritesAndSpace", SYNCED),
  nestTabsFromLinks: flag(true, SYNCED),
  linkPreviews: flag(false, SYNCED),
  warnBeforeHTTP: flag(false, SYNCED),
  fingerprintingProtection: oneOf(["off", "privateWindows", "allWindows"], "privateWindows", SYNCED),
  removeTrackingFromLinks: oneOf(["off", "privateWindows", "allWindows"], "privateWindows", SYNCED),
  topBarAddressView: flag(false, SYNCED),
  themeTranslucency: flag(false, SYNCED),
  favoritePreviews: flag(true, SYNCED),
  archiveAfter: shaped<number>(12, (v) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 720, { type: "integer", minimum: 0, maximum: 720 }, SYNCED),
  searchPageTextInHistory: flag(true, SYNCED),
  tabOrganizerEnabled: flag(false, SYNCED),
  showAIAssistant: flag(true, SYNCED),
  aiProvider: oneOf(["gemini", "openrouter", "ollama", "openai_compatible", "apple_intelligence"], "gemini", SYNCED),
  aiModel: text("", SYNCED),
  ollamaEndpoint: text("http://localhost:11434", SYNCED),
  aiWebSearchEnabled: flag(false, SYNCED),
  aiWebSearchEngine: text("auto", SYNCED),
  aiWebSearchMaxResults: shaped<number>(5, (v) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 20, { type: "integer", minimum: 0, maximum: 20 }, SYNCED),
  aiWebSearchContextSize: oneOf(["low", "medium", "high"], "medium", SYNCED),
  aiToolExecutionMode: oneOf(["auto", "ask", "disabled"], "ask", SYNCED),
  browserControlServerEnabled: flag(false),
  developerModeEnabled: flag(false),
  developerSites: shaped<string[]>([], isStringList, STRING_LIST, SYNCED),
  sponsorBlockEnabled: flag(false, SYNCED),
  sponsorBlockCategories: shaped<Record<string, string>>(
    DEFAULT_SPONSOR_BLOCK_CATEGORIES,
    (v) => isRecordOf(v, (e) => e === "auto" || e === "manual" || e === "disabled"),
    recordOf({ type: "string", enum: ["auto", "manual", "disabled"] }),
    SYNCED,
  ),
  youTubeHideShorts: flag(false, SYNCED),
  enabledOptionalFilterLists: shaped<string[]>(["ublock-annoyances-cookies.txt"], isStringList, STRING_LIST, SYNCED),
  commandBarPreference: oneOf(["website", "search"], "website", SYNCED),
  tabLayout: oneOf(["sidebar", "top"], "sidebar", SYNCED),
  sidebarSide: oneOf(["left", "right"], "left", SYNCED),
  autoHideTabs: flag(false, SYNCED),
  hideToolbarWhileScrolling: flag(true, SYNCED),
  newTabPosition: oneOf(["top", "bottom", "nextToCurrent"], "bottom", SYNCED),
  newTabButtonPosition: oneOf(["top", "bottom"], "bottom", SYNCED),
  appLinksFirst: flag(false, SYNCED),
  newTabOpens: oneOf(["page", "commandBar"], "page", SYNCED),
  reuseEmptyNewTab: flag(false, SYNCED),
  warnBeforeClosingLastTab: flag(true, SYNCED),
  undoReopensClosedTab: flag(false, SYNCED),
  warnBeforeMovingTabsToProfile: flag(true, SYNCED),
  shareTabsAcrossWindows: flag(false),
  tabReorderHaptics: flag(true, SYNCED),
  extendWebsiteColor: flag(true, SYNCED),
  cmdClickCreatesTabGroup: flag(true, SYNCED),
  optShiftClickOpensInGroup: flag(true, SYNCED),
  dragToGroupInTopStrip: flag(false, SYNCED),
  peekModifier: oneOf(["alt", "shift", "off"], "shift", SYNCED),
  peekLinksToOtherSites: flag(true, SYNCED),
  newTabLinksOpenIn: oneOf(["tab", "peek", "littleUniverse"], "peek", SYNCED),
  splitLinkModifier: oneOf(["altShift", "alt"], "altShift", SYNCED),
  autoGroupMeetingTabs: flag(true, SYNCED),
  cleanUpInactiveTabsAfterMinutes: shaped<number | null>(null, (v) => v === null || isWidth(v), { type: ["number", "null"], exclusiveMinimum: 0 }, SYNCED),
  suggestCleanUp: flag(true, SYNCED),
  mutedSites: shaped<string[]>([], isStringList, STRING_LIST, SYNCED),
  showUnreadCounts: flag(false, SYNCED),
  showTopAppBadges: flag(false, SYNCED),
  unreadHiddenSites: shaped<string[]>([], isStringList, STRING_LIST, SYNCED),
  neverTranslateSites: shaped<Record<string, string[]>>({}, (v) => isRecordOf(v, isStringList), recordOf(STRING_LIST)),
  autoPictureInPicture: flag(true, SYNCED),
  commandScrollZoom: flag(true, SYNCED),
  videoUpscaling: flag(true, SYNCED),
  sidebarMediaControls: flag(true, SYNCED),
  sidebarWidth: width(DEFAULT_SIDEBAR_WIDTH),
  showSidebarButton: flag(true, SYNCED),
  showClearButton: flag(true, SYNCED),
  tidyTabs: flag(false, SYNCED),
  balancedTopApps: flag(false, SYNCED),
  showAdvancedSettings: flag(false),
  selectedTabGlow: oneOf(["full", "soft", "off"], "full", SYNCED),
  interfaceStyle: oneOf(["glass", "classic"], "glass", SYNCED),
  glassTintWithTheme: flag(false, SYNCED),
  glassTintAmount: fraction(0.8, SYNCED),
  pageScrollBars: oneOf(["system", "thin"], "system", SYNCED),
  fadeUnloadedTabs: flag(false, SYNCED),
  warnBeforeClosingTabGroup: flag(true, SYNCED),
  batterySaverWhen: oneOf(["lowBattery", "unplugged", "never"], "lowBattery"),
  memorySaver: flag(true),
  memorySaverMode: oneOf(["moderate", "balanced", "maximum"], "balanced"),
  loadProfilesWhenOpened: flag(true),
  keepActiveSites: shaped<string[]>([], isStringList, STRING_LIST, SYNCED),
  extensionSidePanelWidth: width(360),
  showFullUrl: flag(false, SYNCED),
  allowJavaScriptFromAppleEvents: flag(false),
  cliControl: flag(false),
  showBookmarks: flag(true, SYNCED),
  bookmarksBar: oneOf(["always", "newTab", "never"], "never", SYNCED),
  bookmarksBarSize: oneOf(["default", "large"], "default", SYNCED),
  hideBookmarksBarImport: flag(false),
  appearance: oneOf(["auto", "light", "dark"], "auto", SYNCED),
  addressBar: oneOf(["toolbar", "sidebar"], "toolbar", SYNCED),
  compactToolbar: flag(false, SYNCED),
  pageFrame: shaped<number>(PAGE_FRAME.default, validPageFrame, { type: "integer", minimum: PAGE_FRAME.min, maximum: PAGE_FRAME.max }, SYNCED),
  borderlessMode: flag(false, SYNCED),
  pageFrameZeroInFullScreen: flag(false, SYNCED),
  pageFrameZeroWhenTabsHidden: flag(false, SYNCED),
  commandBarPlacement: oneOf(["field", "centred"], "field", SYNCED),
  commandBarStart: shaped<CommandBarStart>({}, isCommandBarStart, COMMAND_BAR_START_SCHEMA),
  spacesFollowAppearance: flag(true),
  adaptTextToColor: flag(true, SYNCED),
  defaultProfileId: text(DEFAULT_PROFILE_ID),
  profileSwitcherIcons: flag(false, SYNCED),
  shortcuts: shaped<Record<string, string[]>>({}, (v) => isRecordOf(v, isStringList), recordOf(STRING_LIST), SYNCED),
  openLinksInLittleUniverse: flag(true),
  littleUniverseOpensNewTabLinks: flag(true, SYNCED),
  littleWindowGestures: flag(true, SYNCED),
  littleUniverseSize: shaped<[number, number]>([900, 640], (v) => Array.isArray(v) && v.length === 2 && v.every(isWidth), { type: "array", prefixItems: [WIDTH, WIDTH], minItems: 2, maxItems: 2 }),
  pageEngine: oneOf(["chromium", "webkit"], "chromium"),
  websiteEngines: shaped<Record<string, "chromium" | "webkit">>({}, (v) => isRecordOf(v, (e) => e === "chromium" || e === "webkit"), recordOf({ type: "string", enum: ["chromium", "webkit"] })),
  protectedVideoInWebKit: flag(true),
  launchActions: shaped<string[]>([], (v) => isStringList(v) && v.length <= 20, { type: "array", items: { type: "string" }, maxItems: 20 }),
  omniboxProviders: shaped<ProviderEntry[]>([], isProviderEntryList, PROVIDERS_SCHEMA),
};

