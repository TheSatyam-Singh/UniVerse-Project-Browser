import { Pressable, View } from "react-native";
import { cancelTimer, formatRemaining, useTimerState } from "../../state/timer/timer";
import { Symbol, Text } from "../ui";
import type { ToolbarPalette } from "../ui/toolbarColors";

export const TIMER_CHIP_WIDTH = 76;

export function TimerChip({ palette, top, right }: { palette: ToolbarPalette; top: number; right: number }) {
  const remaining = useTimerState((s) => s.remaining);
  const active = useTimerState((s) => s.endsAt !== null);
  if (!active) return null;
  return (
    <View
      style={{
        position: "absolute",
        top,
        right,
        height: 28,
        width: TIMER_CHIP_WIDTH,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        borderRadius: 14,
        backgroundColor: palette.pill,
      }}
    >
      <Symbol name="timer" size={13} color={palette.icon} />
      <Text size="caption" style={{ color: palette.text }}>
        {formatRemaining(remaining)}
      </Text>
      <Pressable onPress={cancelTimer} accessibilityLabel="Cancel timer">
        <Symbol name="xmark" size={11} color={palette.secondary} />
      </Pressable>
    </View>
  );
}
