import { useState } from "react";
import { Pressable, View } from "react-native";
import { openInternalPage } from "../../state/pages/urls";
import { Box, Symbol, Text } from "../ui";
import { NtpCard, NtpCardSlot, NtpCardSurface, NtpCardTitle, useCardRetire } from "./NtpCard";
import { useNtpColors } from "./tokens";

const FRAME = { width: 282, height: 69 };

export function SurfCard({ windowId }: { windowId: string }) {
  const [leaving, retire] = useCardRetire();
  if (leaving) return null;
  return (
    <NtpCardSlot width={FRAME.width} height={FRAME.height}>
      <Card leaving={leaving} onPlay={() => openInternalPage("surf", windowId)} onClose={() => retire(() => {})} />
    </NtpCardSlot>
  );
}

function Card({ leaving, onPlay, onClose }: { leaving: null | (() => void); onPlay: () => void; onClose: () => void }) {
  const colors = useNtpColors();
  const [pressed, setPressed] = useState(false);
  return (
    <NtpCard appearDelay={450} leaving={leaving} onClose={onClose} lift pressed={pressed} style={FILL}>
      <Pressable
        onPress={onPlay}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel="UniVerse Surf. Play the game"
        style={FILL}
      >
        <NtpCardSurface />
        <Box row padX="ml" gap="ml" style={ROW}>
          <Text size="body" style={SURF_ICON}>🏄</Text>
          <Box gap="xxs" style={TEXT_COLUMN}>
            <NtpCardTitle>UniVerse Surf</NtpCardTitle>
            <View style={ACTION_ROW}>
              <Text size="small" style={{ color: colors.body }}>
                Ride the wave
              </Text>
              <Symbol name="arrow.up.right" size={9} weight="medium" color={colors.arrow} style={ARROW} />
            </View>
          </Box>
        </Box>
      </Pressable>
    </NtpCard>
  );
}

const FILL = { flex: 1 } as const;
const ROW = { flex: 1, alignItems: "center" } as const;
const SURF_ICON = { fontSize: 32 } as const;
const TEXT_COLUMN = { flex: 1 } as const;
const ACTION_ROW = { flexDirection: "row", alignItems: "center", gap: 4 } as const;
const ARROW = { width: 11, height: 11 } as const;
