import { calculate } from "@universe/core";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { showToast } from "../../state/app/toasts";
import { openWindow } from "../../state/browser/actions";
import { useWindowProfileId } from "../../state/browser/hooks";
import { openInternalPage } from "../../state/pages/urls";
import { openSettings } from "../../state/settings/settingsWindows";
import { startTimer } from "../../state/timer/timer";
import { Symbol, Text, TextField } from "../ui";
import { useNtpColors } from "./tokens";

const TIMER_PRESETS = [
  { seconds: 300, label: "5 min" },
  { seconds: 600, label: "10 min" },
  { seconds: 900, label: "15 min" },
];

function ToolButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const colors = useNtpColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.cardFill, borderWidth: 1, borderColor: colors.cardBorder }}
    >
      <Symbol name={icon} size={13} color={colors.title} />
      <Text size="small" style={{ color: colors.title }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function QuickTools({ windowId, bar }: { windowId: string; bar: { x: number; y: number; width: number; height: number } }) {
  const colors = useNtpColors();
  const profileId = useWindowProfileId();
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const onCalc = (text: string) => {
    setExpression(text);
    const calc = text.trim() ? calculate(text) : null;
    setResult(calc ? calc.display : "");
  };
  return (
    <View style={{ position: "absolute", left: bar.x, top: bar.y + bar.height + 132, width: bar.width, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {TIMER_PRESETS.map((preset) => (
        <ToolButton
          key={preset.seconds}
          icon="timer"
          label={preset.label}
          onPress={() => {
            startTimer(preset.seconds, `${preset.label} timer`, windowId);
            showToast(windowId, "Timer started", `${preset.label} timer`);
          }}
        />
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.cardFill, borderWidth: 1, borderColor: colors.cardBorder }}>
        <Symbol name="equal.circle" size={13} color={colors.title} />
        <TextField value={expression} onChangeText={onCalc} placeholder="2 + 2" width={96} />
        {result ? (
          <Text size="small" style={{ color: colors.title }}>
            = {result}
          </Text>
        ) : null}
      </View>
      <ToolButton icon="eye.slash" label="New private window" onPress={() => openWindow({ kind: "private", profileId })} />
      <ToolButton icon="arrow.down.circle" label="Downloads" onPress={() => openInternalPage("downloads", windowId)} />
      <ToolButton icon="clock" label="History" onPress={() => openInternalPage("history", windowId)} />
      <ToolButton icon="gearshape" label="Settings" onPress={() => openSettings()} />
    </View>
  );
}
