let restoredFromHistory = 0;

export function noteClosedTabRestoredFromHistory() {
  restoredFromHistory++;
}

export function takeClosedTabRestoreCounts() {
  const counts = { closed_tabs_restored_from_history: restoredFromHistory };
  restoredFromHistory = 0;
  return counts;
}
