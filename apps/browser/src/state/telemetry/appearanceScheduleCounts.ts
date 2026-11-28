let switches = 0;

export function noteAppearanceScheduleSwitch() {
  switches++;
}

export function takeAppearanceScheduleCounts() {
  const counts = { appearance_schedule_switches: switches };
  switches = 0;
  return counts;
}
