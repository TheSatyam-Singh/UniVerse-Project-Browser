import { useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { layout, useTheme } from "../ui/theme";
import { Box, space, Symbol, Text } from "../ui";
import { Favicon } from "../favicon/Favicon";
import { capture } from "../../state/telemetry/client";
import { openReadingListItem } from "../../state/readingList/actions";
import { clearReadingList, loadReadingList, removeReadingList, useReadingList } from "../../state/readingList/readingList";
import type { ReadingListItem } from "../../state/readingList/readingListDocument";
import { setSidebarUi, useSidebarUi } from "../../state/sidebar/sidebarUi";
import { SectionLabel } from "./SectionLabel";
import { SidebarListRow } from "./SidebarRow";

const ROW_HEIGHT_OFFSET = space.xl;

function savedDateLabel(addedAt: number): string {
  return new Date(addedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ReadingListPanel({ windowId }: { windowId: string }) {
  const theme = useTheme();
  const open = useSidebarUi((u) => u.readingList === windowId);
  const items = useReadingList((s) => s.items);

  useEffect(() => {
    if (open) {
      loadReadingList();
      capture("reading_list_opened", {});
    }
  }, [open]);

  if (!open) return null;
  return (
    <View style={{ position: "absolute", left: layout.sidebarInset, right: layout.sidebarInset, top: layout.sidebarHeader, bottom: 0 }}>
      <View style={{ flex: 1, backgroundColor: theme.card, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: theme.panelBorder, padding: space.m, gap: space.m }}>
        <Box row style={{ alignItems: "center" }}>
          <Text weight="semibold" style={{ flex: 1 }}>
            Reading List
          </Text>
          <Pressable onPress={() => setSidebarUi({ readingList: null })} accessibilityRole="button" accessibilityLabel="Close reading list">
            <Symbol name="xmark" size={12} color={theme.textSecondary} />
          </Pressable>
        </Box>
        {items.length === 0 ? (
          <Text size="small" tone="textSecondary">
            No saved pages yet. Add the current page from the tab menu.
          </Text>
        ) : (
          <View style={{ flex: 1 }}>
            <SectionLabel title="Saved pages" inset={0} top={space.xs} bottom={space.xs} />
            <ScrollView style={{ flex: 1 }}>
              {items.map((item) => (
                <ReadingListRow
                  key={item.url}
                  item={item}
                  onOpen={() => openReadingListItem(windowId, item.url)}
                  onRemove={() => removeReadingList(item.url)}
                />
              ))}
            </ScrollView>
            <Pressable onPress={clearReadingList} accessibilityRole="button" accessibilityLabel="Clear reading list">
              <Text size="small" tone="textSecondary" style={{ paddingTop: space.s }}>
                Clear All
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function ReadingListRow({ item, onOpen, onRemove }: { item: ReadingListItem; onOpen: () => void; onRemove: () => void }) {
  const theme = useTheme();
  return (
    <SidebarListRow height={layout.rowHeight + ROW_HEIGHT_OFFSET}>
      <Pressable onPress={onOpen} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space.s }}>
        <Favicon url={item.url} favicon={item.favicon} size={16} />
        <View style={{ flex: 1 }}>
          <Text lines={1}>{item.title}</Text>
          <Text size="small" tone="textSecondary" lines={1}>
            {item.site} · {savedDateLabel(item.addedAt)}
          </Text>
        </View>
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${item.title} from reading list`}>
          <Symbol name="xmark" size={10} color={theme.textTertiary} />
        </Pressable>
      </Pressable>
    </SidebarListRow>
  );
}
