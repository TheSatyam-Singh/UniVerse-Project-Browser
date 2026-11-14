import type * as ImportApi from "@universe/import";

export type {
  BookmarkNode,
  BrowserProfile,
  BrowserSource,
  Credential,
  DiaTabsProfile,
  DiaTabsResult,
  ImportedExtension,
  ImportedFavicon,
  ImportedTab,
  ImportKind,
  ImportResult,
  SafariExport,
  SpaceSuggestion,
  SpaceSummary,
} from "@universe/import";

let api: typeof ImportApi | undefined;

export const importModule = (): typeof ImportApi => (api ??= require("@universe/import") as typeof ImportApi);
