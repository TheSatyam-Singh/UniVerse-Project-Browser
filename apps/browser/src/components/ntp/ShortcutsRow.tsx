import { hostOf } from "@universe/core";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { Favicon } from "../favicon/Favicon";
import { Text } from "../ui";
import { useWindowProfileId } from "../../state/browser/hooks";
import type { HistoryEntry } from "../../state/browser/types";
import { useProfileHistory } from "../../state/history/hooks";
import { navigate } from "../../state/tabs/actions";
import { useNtpColors } from "./tokens";

const DEFAULTS = [
  { url: "https://www.youtube.com", title: "YouTube" },
  { url: "https://github.com", title: "GitHub" },
  { url: "https://www.wikipedia.org", title: "Wikipedia" },
  { url: "https://developer.mozilla.org", title: "MDN" },
];

type Shortcut = { url: string; title: string };

function topSites(history: HistoryEntry[]): Shortcut[] {
  const byHost = new Map<string, Shortcut & { visits: number }>();
  for (const entry of history) {
    const host = hostOf(entry.url);
    if (!host) continue;
    const current = byHost.get(host);
    if (!current || entry.visits > current.visits) byHost.set(host, { url: entry.url, title: entry.title || host, visits: entry.visits });
  }
  const ranked = [...byHost.values()].sort((a, b) => b.visits - a.visits).slice(0, 8);
  const sites = ranked.map(({ url, title }) => ({ url, title }));
  for (const fallback of DEFAULTS) {
    if (sites.length >= 8) break;
    if (!sites.some((s) => hostOf(s.url) === hostOf(fallback.url))) sites.push(fallback);
  }
  return sites;
}

export function ShortcutsRow({ tabId, bar }: { tabId: string; bar: { x: number; y: number; width: number; height: number } }) {
  const colors = useNtpColors();
  const profileId = useWindowProfileId();
  const history = useProfileHistory(profileId);
  const sites = useMemo(() => topSites(history), [history]);
  return (
    <View style={{ position: "absolute", left: bar.x, top: bar.y + bar.height + 24, width: bar.width, flexDirection: "row", justifyContent: "center", gap: 20 }}>
      {sites.map((site) => (
        <Pressable
          key={site.url}
          onPress={() => navigate(tabId, site.url)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${site.title}`}
          style={{ width: 72, alignItems: "center", gap: 8 }}
        >
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.cardFill, borderWidth: 1, borderColor: colors.cardBorder, alignItems: "center", justifyContent: "center" }}>
            <Favicon url={site.url} size={28} profileId={profileId} />
          </View>
          <Text lines={1} size="small" style={{ color: colors.body }}>
            {site.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
