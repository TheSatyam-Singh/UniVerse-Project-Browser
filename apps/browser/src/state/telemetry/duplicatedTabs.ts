let duplicated = 0;

export function noteTabDuplicated() {
  duplicated++;
}

export function takeDuplicatedTabCounts() {
  const counts = { tabs_duplicated: duplicated };
  duplicated = 0;
  return counts;
}
