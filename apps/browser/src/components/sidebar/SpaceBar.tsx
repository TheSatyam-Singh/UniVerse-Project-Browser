import { Pressable, ScrollView, View } from "react-native";
import { Button, ContextMenuArea, Dot, Text, capsule, ink, space } from "../ui";
import { GROUP_COLORS } from "../../state/groups/tokens";
import { useActiveSpaceId, useSpaces } from "../../state/spaces/hooks";
import { createSpace, switchSpace } from "../../state/spaces/actions";
import { openSpaceMenu } from "../../state/spaces/spaceMenu";
import { groupSurface, SPACE_BAR_HEIGHT, SPACE_DOT, useSidebarTokens } from "./tokens";

const BAR = { height: SPACE_BAR_HEIGHT, flexDirection: "row", alignItems: "center", paddingHorizontal: space.s, gap: space.xs } as const;
const CHIP = { flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.s, height: space.xl, borderRadius: capsule(space.xl), borderWidth: 1 } as const;

export function SpaceBar({ windowId }: { windowId: string }) {
  const spaces = useSpaces(windowId);
  const activeSpaceId = useActiveSpaceId(windowId);
  const tokens = useSidebarTokens();
  if (!spaces.length) return null;
  return (
    <View style={BAR}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
        <SpaceChip windowId={windowId} label="All" active={activeSpaceId === null} fill={tokens.groupFill} stroke={tokens.groupStroke} />
        {spaces.map((space) => {
          const surface = groupSurface(space.color, tokens);
          return (
            <SpaceChip
              key={space.id}
              windowId={windowId}
              label={space.name}
              dot={GROUP_COLORS[space.color].hex}
              active={activeSpaceId === space.id}
              fill={surface.fill}
              stroke={surface.stroke}
              onPress={() => switchSpace(windowId, space.id)}
              onContextMenu={() => void openSpaceMenu(windowId, space.id)}
            />
          );
        })}
      </ScrollView>
      <Button variant="icon" icon="plus" tooltip="New Space" onPress={() => void createSpace(windowId)} />
    </View>
  );
}

function SpaceChip({
  windowId,
  label,
  dot,
  active,
  fill,
  stroke,
  onPress,
  onContextMenu,
}: {
  windowId: string;
  label: string;
  dot?: string;
  active: boolean;
  fill: string;
  stroke: string;
  onPress?: () => void;
  onContextMenu?: () => void;
}) {
  const press = onPress ?? (() => switchSpace(windowId, null));
  const chip = (
    <Pressable onPress={press} style={[CHIP, { backgroundColor: active ? fill : ink.clear, borderColor: active ? stroke : ink.clear }]}>
      {dot ? <Dot size={SPACE_DOT} color={dot} /> : null}
      <Text size="small" weight={active ? "semibold" : "regular"} tone={active ? "textPrimary" : "textSecondary"} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
  return onContextMenu ? <ContextMenuArea onContextMenu={onContextMenu}>{chip}</ContextMenuArea> : chip;
}
