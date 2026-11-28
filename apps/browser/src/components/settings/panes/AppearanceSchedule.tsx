import { useEffect, useState } from "react";
import { PopUp, TextField } from "../../ui";
import { useSettings } from "../../../state/browser/hooks";
import { updateSettings } from "../../../state/settings/actions";
import type { Settings } from "../../../state/settings/settings";
import { formatTimeOfDay, parseTimeOfDay } from "../../../state/settings/appearanceSchedule";
import { Group, Row, SectionHeader } from "../Form";

const MODES: { value: Settings["appearanceSchedule"]; title: string }[] = [
  { value: "off", title: "Off" },
  { value: "sunset", title: "Sunset to sunrise" },
  { value: "custom", title: "Custom times" },
];

export function AppearanceSchedulePicker() {
  const schedule = useSettings((s) => s.appearanceSchedule);
  return (
    <>
      <SectionHeader anchor="appearance.appearanceSchedule" />
      <Group>
        <Row anchor="appearance.appearanceSchedule">
          <PopUp value={schedule} options={MODES} onChange={(v) => updateSettings({ appearanceSchedule: v })} minWidth={170} />
        </Row>
        {schedule === "custom" ? (
          <>
            <Row anchor="appearance.appearanceScheduleStart">
              <TimeField setting="appearanceScheduleStart" />
            </Row>
            <Row anchor="appearance.appearanceScheduleEnd">
              <TimeField setting="appearanceScheduleEnd" />
            </Row>
          </>
        ) : null}
        {schedule === "sunset" ? (
          <>
            <Row anchor="appearance.appearanceScheduleLatitude">
              <CoordinateField setting="appearanceScheduleLatitude" placeholder="e.g. 30.73" />
            </Row>
            <Row anchor="appearance.appearanceScheduleLongitude">
              <CoordinateField setting="appearanceScheduleLongitude" placeholder="e.g. 76.77" />
            </Row>
          </>
        ) : null}
      </Group>
    </>
  );
}

type TimeSetting = "appearanceScheduleStart" | "appearanceScheduleEnd";

function TimeField({ setting }: { setting: TimeSetting }) {
  const saved = useSettings((s) => s[setting]);
  const [text, setText] = useState(saved);
  useEffect(() => setText(saved), [saved]);
  const commit = () => {
    const minutes = parseTimeOfDay(text);
    if (minutes === null) {
      setText(saved);
      return;
    }
    updateSettings({ [setting]: formatTimeOfDay(minutes) });
  };
  return <TextField value={text} onChangeText={setText} onSubmit={commit} onBlur={commit} mono width={64} invalid={parseTimeOfDay(text) === null} />;
}

type CoordinateSetting = "appearanceScheduleLatitude" | "appearanceScheduleLongitude";

function CoordinateField({ setting, placeholder }: { setting: CoordinateSetting; placeholder: string }) {
  const saved = useSettings((s) => s[setting]);
  const max = setting === "appearanceScheduleLatitude" ? 90 : 180;
  const [text, setText] = useState(saved === null ? "" : String(saved));
  useEffect(() => setText(saved === null ? "" : String(saved)), [saved]);
  const parsed = text.trim() === "" ? null : Number(text);
  const valid = parsed === null || (Number.isFinite(parsed) && Math.abs(parsed) <= max);
  const commit = () => {
    if (text.trim() === "") {
      updateSettings({ [setting]: null });
      return;
    }
    if (!valid || parsed === null) {
      setText(saved === null ? "" : String(saved));
      return;
    }
    updateSettings({ [setting]: parsed });
  };
  return <TextField value={text} onChangeText={setText} onSubmit={commit} onBlur={commit} placeholder={placeholder} mono width={96} invalid={!valid} />;
}
