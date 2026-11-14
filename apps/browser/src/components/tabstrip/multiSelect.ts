export type StripRow = { id: string; section: string; isFolder: boolean };

export function orderedMultiSelection(selected: readonly string[], orderedIds: readonly string[]): string[] {
  const inOrder = orderedIds.filter((id) => selected.includes(id));
  return inOrder.length > 1 ? inOrder : [];
}

export function stripSectionTabIds(rows: readonly StripRow[], tabId: string): string[] {
  const row = rows.find((r) => r.id === tabId);
  if (!row) return [];
  return rows.filter((r) => r.section === row.section && !r.isFolder).map((r) => r.id);
}

export function rangeWithinSection(rows: readonly StripRow[], anchorId: string, tabId: string): string[] {
  const ids = stripSectionTabIds(rows, tabId);
  const from = ids.indexOf(anchorId);
  const to = ids.indexOf(tabId);
  if (from < 0 || to < 0) return ids.includes(tabId) ? [tabId] : [];
  return ids.slice(Math.min(from, to), Math.max(from, to) + 1);
}

export function multiSelectDropOrder(
  group: readonly string[],
  draggedId: string,
): { beforeDragged: string[]; afterDragged: string[] } | null {
  const at = group.indexOf(draggedId);
  if (at < 0) return null;
  return { beforeDragged: group.slice(0, at), afterDragged: group.slice(at + 1) };
}

export function dropAnchorForGroup(group: readonly string[], draggedId: string, siblingsAfterDrop: readonly string[]): string | null {
  const at = group.indexOf(draggedId);
  if (at < 0) return null;
  const rest = new Set(group);
  const draggedIndex = siblingsAfterDrop.indexOf(draggedId);
  for (let i = draggedIndex - 1; i >= 0; i--) {
    const id = siblingsAfterDrop[i]!;
    if (!rest.has(id)) return id;
  }
  return null;
}
