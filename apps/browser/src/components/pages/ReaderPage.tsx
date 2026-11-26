import { ScrollView, View } from "react-native";
import { useReader, type ReaderSize } from "../../state/reader/reader";
import { Button, Segmented, Text, space } from "../ui";

const SIZE_STEPS: ReaderSize[] = ["s", "m", "l", "xl"];
const SIZE_VALUE: Record<ReaderSize, number> = { s: 15, m: 18, l: 21, xl: 24 };

const THEMES = {
  light: { bg: "#ffffff", text: "#1d1d1f", secondary: "#6e6e73", divider: "#e5e5e5" },
  sepia: { bg: "#f7f1e3", text: "#3b2f23", secondary: "#8a7a63", divider: "#e3d9c2" },
  dark: { bg: "#1c1c1e", text: "#e8e6e3", secondary: "#98989d", divider: "#38383a" },
} as const;

export function ReaderPage({ tabId }: { tabId: string }) {
  const entry = useReader((s) => s.entries[tabId]);
  const font = useReader((s) => s.font);
  const size = useReader((s) => s.size);
  const themeName = useReader((s) => s.theme);
  const setFont = useReader((s) => s.setFont);
  const setSize = useReader((s) => s.setSize);
  const setTheme = useReader((s) => s.setTheme);
  const closeReader = useReader((s) => s.closeReader);
  const t = THEMES[themeName];
  const base = SIZE_VALUE[size];
  const family = font === "serif" ? "Georgia" : font === "mono" ? "Menlo" : undefined;
  const sizeIndex = SIZE_STEPS.indexOf(size);
  const stepSize = (dir: 1 | -1) => setSize(SIZE_STEPS[Math.min(SIZE_STEPS.length - 1, Math.max(0, sizeIndex + dir))]!);
  if (!entry) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: space.l }}>
        <Text style={{ color: t.secondary, fontSize: base }}>Open Reader from a page to read it here.</Text>
      </View>
    );
  }
  const article = entry.article;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.s, paddingHorizontal: space.m, paddingVertical: space.s, borderBottomWidth: 1, borderBottomColor: t.divider }}>
        <Button variant="text" title="‹ Back to page" look="toolbar" onPress={() => closeReader(tabId)} />
        <View style={{ flex: 1 }} />
        <Segmented
          options={[
            { value: "serif", title: "Serif" },
            { value: "sans", title: "Sans" },
            { value: "mono", title: "Mono" },
          ]}
          value={font}
          onChange={setFont}
        />
        <Button variant="icon" icon="textformat.size.smaller" tooltip="Smaller text" disabled={sizeIndex <= 0} onPress={() => stepSize(-1)} />
        <Button variant="icon" icon="textformat.size.larger" tooltip="Larger text" disabled={sizeIndex >= SIZE_STEPS.length - 1} onPress={() => stepSize(1)} />
        <Segmented
          options={[
            { value: "light", title: "Light" },
            { value: "sepia", title: "Sepia" },
            { value: "dark", title: "Dark" },
          ]}
          value={themeName}
          onChange={setTheme}
        />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: space.l, paddingVertical: space.l, alignItems: "center" }}>
        {!article ? (
          <View style={{ maxWidth: 640, gap: space.s }}>
            <Text style={{ color: t.text, fontSize: base * 1.4, fontWeight: "700", fontFamily: family }}>No article found on this page.</Text>
            <Text style={{ color: t.secondary, fontSize: base, fontFamily: family }}>Reader works best on articles and long pages. The page might be a homepage, a feed, or mostly images.</Text>
            <Button variant="text" title="Back to page" look="toolbar" onPress={() => closeReader(tabId)} />
          </View>
        ) : (
          <View style={{ maxWidth: 680, width: "100%", gap: space.m }}>
            <Text style={{ color: t.text, fontSize: base * 1.7, fontWeight: "700", lineHeight: base * 1.7 * 1.25, fontFamily: family }}>{article.title}</Text>
            {article.byline || article.siteName ? (
              <Text style={{ color: t.secondary, fontSize: base * 0.85, fontFamily: family }}>
                {[article.byline, article.siteName].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
            {article.blocks.map((b, i) => {
              if (b.kind === "h1" || b.kind === "h2" || b.kind === "h3") {
                const scale = b.kind === "h1" ? 1.4 : b.kind === "h2" ? 1.25 : 1.12;
                return (
                  <Text key={i} style={{ color: t.text, fontSize: base * scale, fontWeight: "700", lineHeight: base * scale * 1.3, fontFamily: family }}>
                    {b.text}
                  </Text>
                );
              }
              if (b.kind === "quote") {
                return (
                  <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: t.secondary, paddingLeft: space.m }}>
                    <Text style={{ color: t.secondary, fontSize: base, fontStyle: "italic", lineHeight: base * 1.65, fontFamily: family }}>{b.text}</Text>
                  </View>
                );
              }
              if (b.kind === "li") {
                return (
                  <Text key={i} style={{ color: t.text, fontSize: base, lineHeight: base * 1.65, fontFamily: family }}>
                    {"•  "}
                    {b.text}
                  </Text>
                );
              }
              return (
                <Text key={i} style={{ color: t.text, fontSize: base, lineHeight: base * 1.65, fontFamily: family }}>
                  {b.text}
                </Text>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
