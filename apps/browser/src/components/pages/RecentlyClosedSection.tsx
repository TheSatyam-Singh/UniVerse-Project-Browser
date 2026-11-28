import { memo, useState } from "react";
import { Pressable, View } from "react-native";
import { markHoverProps } from "../../lib/hoverMarks";
import { tabLabel } from "../../state/browser/model";
import type { ClosedTab } from "../../state/browser/types";
import { noteClosedTabRestoredFromHistory } from "../../state/telemetry/closedTabs";
import { restoreClosed } from "../../state/windows/actions";
import { Favicon } from "../favicon/Favicon";
import { radius, space, Text, useTheme } from "../ui";
import { hostLabel, PAGE_WIDTH, timeLabel } from "./PageLayout";
import { historyRow, pageType } from "./tokens";

const SECTION = { width: PAGE_WIDTH, maxWidth: "100%" } as const;
const HEADER = { height: historyRow.header, justifyContent: "flex-end", paddingBottom: space.m, paddingHorizontal: historyRow.headerInset } as const;
const ROW_FRAME = { height: historyRow.height, paddingHorizontal: space.xl } as const;
const TIME = { width: historyRow.timeWidth } as const;
const LINK = { flex: 1, flexDirection: "row", alignItems: "center", gap: space.ml } as const;
const TITLE = { flexShrink: 1 } as const;
const HOST = { flexShrink: 0, maxWidth: historyRow.hostMaxWidth } as const;

export function RecentlyClosedSection({ closed, profileId, windowId }: { closed: ClosedTab[]; profileId: string; windowId: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={SECTION}>
        <View style={HEADER}>
          <Text weight="semibold" tone="textSecondary" style={pageType.dayHeader}>
            Recently Closed
          </Text>
        </View>
        {closed.map((c, i) => (
          <RecentlyClosedRow key={c.id} closed={c} profileId={profileId} windowId={windowId} first={i === 0} last={i === closed.length - 1} />
        ))}
      </View>
    </View>
  );
}

const RecentlyClosedRow = memo(function RecentlyClosedRow({
  closed,
  profileId,
  windowId,
  first,
  last,
}: {
  closed: ClosedTab;
  profileId: string;
  windowId: string;
  first: boolean;
  last: boolean;
}) {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);
  const [hoverProps] = useState(() => markHoverProps({ onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }));
  const title = closed.tab.title || tabLabel(closed.tab);
  const restore = () => {
    noteClosedTabRestoredFromHistory();
    restoreClosed(closed.id, windowId);
  };
  const r = radius.panel;
  return (
    <View {...hoverProps} style={ROW_FRAME}>
      <Pressable
        onPress={restore}
        accessibilityRole="button"
        accessibilityLabel={`Reopen ${title}`}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: space.l,
          gap: space.l,
          backgroundColor: hovered ? theme.rowHover : theme.groupFill,
          borderTopLeftRadius: first ? r : 0,
          borderTopRightRadius: first ? r : 0,
          borderBottomLeftRadius: last ? r : 0,
          borderBottomRightRadius: last ? r : 0,
        }}
      >
        <Text size="small" tone="textSecondary" style={TIME}>
          {timeLabel(closed.closedAt)}
        </Text>
        <View style={LINK}>
          <Favicon url={closed.tab.url} favicon={closed.tab.favicon} profileId={profileId} />
          <Text lines={1} style={TITLE}>
            {title}
          </Text>
          <Text lines={1} size="small" tone="textTertiary" style={HOST}>
            {hostLabel(closed.tab.url)}
          </Text>
        </View>
      </Pressable>
    </View>
  );
});
