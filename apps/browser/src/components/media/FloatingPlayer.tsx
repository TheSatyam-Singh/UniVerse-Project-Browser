import { View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { hostOf } from "@universe/core";
import { useBrowser } from "../../state/browser/store";
import { viewTabIds } from "../../state/browser/model";
import { switchToTab } from "../../state/browser/actions";
import { useTab } from "../../state/browser/hooks";
import { dismissPlayer, isPlaying, playerTabFor, useMedia, useSession } from "../../state/media/media";
import { capture } from "../../state/telemetry/client";
import { Button, Text, radius, space, useTheme } from "../ui";
import { MiniPlayer, MINI_PLAYER_WIDTH } from "./MiniPlayer";

export function FloatingPlayer({ windowId, tabId }: { windowId: string; tabId: string }) {
  const theme = useTheme();
  const tabIds = useBrowser(useShallow((s) => viewTabIds(s, windowId)));
  const playerTab = useMedia((m) => playerTabFor(m, tabIds.filter((id) => id !== tabId)));
  const session = useSession(playerTab);
  const url = useTab(playerTab ?? "", (t) => t?.url ?? "");
  if (!playerTab || !session || !isPlaying(session)) return null;
  return (
    <View
      style={{
        position: "absolute",
        right: 16,
        bottom: 16,
        width: MINI_PLAYER_WIDTH + 16,
        backgroundColor: theme.card,
        borderRadius: radius.control,
        borderWidth: 1,
        borderColor: theme.divider,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: space.s, paddingTop: space.xs }}>
        <Text size="caption" tone="textSecondary" lines={1} style={{ flex: 1 }}>
          Playing in another tab · {hostOf(url)}
        </Text>
        <Button
          variant="close"
          look="panel"
          onPress={() => {
            capture("floating_player_dismissed");
            dismissPlayer(playerTab);
          }}
        />
      </View>
      <MiniPlayer
        tabId={playerTab}
        onBackToTab={() => {
          capture("floating_player_back_to_tab");
          switchToTab(playerTab);
        }}
      />
    </View>
  );
}
