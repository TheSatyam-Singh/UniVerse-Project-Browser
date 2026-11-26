import type { FaviconImage } from "@universe-real/universecore";
import { faviconFor } from "../pages";
import { provideNativeModule } from "./expo-modules-core";

export * from "@universe-real/universecore";
export { devPagerState, pagerState, selectPager, stepPager, SwipeArea, switchPager } from "./web/Pager";
export { WebView } from "./web/WebView";

const ENGINE_ONLY: Record<string, string[]> = {
  UniVerseHistory: ["query", "add", "import", "deleteUrls", "watch"],
  UniVerseBookmarks: ["tree", "apply", "watch"],
  UniVerseFavicons: ["get", "set"],
  UniVerseTabs: ["lastTabPolicy"],
  UniVerseEngine: ["batterySaver", "trimMemory", "openTaskManager", "cliControlStatus", "setCliControl", "setCliActiveTab", "cliTabTargets"],
  UniVerseExtensions: ["watchActions", "syncState", "syncApply"],
  UniVerseDownloads: ["settings", "setSettings"],
};
const ANSWERS: Record<string, Record<string, unknown>> = {
  UniVerseTabs: { strips: { rev: 0, cmd: null, strips: [] } },
  UniVerseExtensions: { list: { extensions: [] } },
  UniVerseSearch: { engines: { list: { engines: [] } } },
};
for (const module of new Set([...Object.keys(ENGINE_ONLY), ...Object.keys(ANSWERS)]))
  provideNativeModule(module, {
    call: async (name: string) => {
      if (ENGINE_ONLY[module]?.includes(name)) throw Object.assign(new Error(`${name} is not on the web`), { code: "ERR_ENGINE" });
      return JSON.stringify(ANSWERS[module]?.[name] ?? null);
    },
  });

export async function faviconsFor(_profile: string, pages: string[], _icons: string[] = []) {
  const found = pages.flatMap((page) => {
    const uri = faviconFor(page);
    return uri ? [[page, { uri, icon: uri }] as const] : [];
  });
  return { pages: new Map(found), icons: new Map<string, string>() };
}

export async function fetchFavicon(url: string, _profile: string, _page?: string): Promise<FaviconImage | null> {
  return { uri: url, width: 32, height: 32 };
}
