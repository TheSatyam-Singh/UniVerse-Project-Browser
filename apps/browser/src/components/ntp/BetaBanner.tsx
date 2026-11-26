import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { create } from "zustand";
import { newTab } from "../../state/tabs/actions";
import { Box, IconTile, ink, space, Symbol, Text } from "../ui";
import { NtpCard, NtpCardSlot, NtpCardSurface, NtpCardTitle, useCardRetire } from "./NtpCard";
import { useNtpColors } from "./tokens";

const ICON = require("../../../assets/app-icon.png");
const ISSUES_URL = "https://github.com/TheSatyam-Singh/UniVerse-Project-Browser/issues";

const FRAME = { width: 282, height: 86 };
const ICON_SIZE = 36;

type BetaState = { dismissed: boolean; dismiss: () => void };
const useBeta = create<BetaState>()((set) => ({ dismissed: false, dismiss: () => set({ dismissed: true }) }));

export function BetaBanner({ windowId }: { windowId: string }) {
  const dismissed = useBeta((s) => s.dismissed);
  const dismiss = useBeta((s) => s.dismiss);
  const [leaving, retire] = useCardRetire();
  if ((dismissed && !leaving)) return null;
  return (
    <NtpCardSlot width={FRAME.width} height={FRAME.height}>
      <Card leaving={leaving} windowId={windowId} onClose={() => retire(dismiss)} />
    </NtpCardSlot>
  );
}

function Card({ leaving, windowId, onClose }: { leaving: null | (() => void); windowId: string; onClose: () => void }) {
  const colors = useNtpColors();
  const [pressed, setPressed] = useState(false);
  return (
    <NtpCard appearDelay={300} leaving={leaving} onClose={onClose} lift pressed={pressed} style={FILL}>
      <Pressable
        onPress={() => newTab(windowId, { url: ISSUES_URL })}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel="Beta build. Report an issue on GitHub"
        style={FILL}
      >
        <NtpCardSurface />
        <Box row padX="ml" gap="ml" style={ROW}>
          <IconTile size="l" fill={ink.clear}>
            <Image source={ICON} style={ICON_IMAGE} />
          </IconTile>
          <Box gap="xxs" style={TEXT_COLUMN}>
            <NtpCardTitle>Beta build</NtpCardTitle>
            <Text size="small" style={{ color: colors.body }}>
              You might run into errors. Found one?
            </Text>
            <View style={ACTION_ROW}>
              <Text size="small" style={{ color: colors.body }}>
                Report an issue on GitHub
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
const ICON_IMAGE = { width: ICON_SIZE, height: ICON_SIZE } as const;
const TEXT_COLUMN = { flex: 1, paddingLeft: space.xs } as const;
const ACTION_ROW = { flexDirection: "row", alignItems: "center", gap: space.xs } as const;
const ARROW = { width: 11, height: 11 } as const;
