import { useBrowser } from "../browser/store";
import { prompt } from "../../platform/dialogs";
import type { GroupTint } from "../groups/tokens";
import { noteSessionRestored, noteSessionSaved, noteSpaceCreated, noteSpaceSwitched, noteTabsArchived } from "../telemetry/usage";

const store = () => useBrowser.getState();

export const createSpace = (windowId: string) => {
  const id = store().createSpace(windowId);
  if (id) noteSpaceCreated();
  return id;
};

export const switchSpace = (windowId: string, spaceId: string | null) => {
  store().switchSpace(windowId, spaceId);
  noteSpaceSwitched();
};

export const renameSpace = async (windowId: string, spaceId: string) => {
  const space = store().spaces[spaceId];
  if (!space) return;
  const name = await prompt({ title: "Rename Space", value: space.name, placeholder: space.name, confirmTitle: "Rename", windowId });
  if (name !== null) store().renameSpace(spaceId, name);
};

export const setSpaceColor = (id: string, color: GroupTint) => store().setSpaceColor(id, color);

export const deleteSpace = (id: string) => store().deleteSpace(id);

export const moveTabsToSpace = (windowId: string, tabIds: string[], spaceId: string | null) => store().moveTabsToSpace(windowId, tabIds, spaceId);

export const newTabInSpace = (windowId: string, spaceId: string) => store().newTabInSpace(windowId, spaceId);

export const archiveTabs = (windowId: string, tabIds: string[]) => {
  const n = store().archiveTabs(windowId, tabIds);
  if (n) noteTabsArchived(n);
  return n;
};

export const restoreArchivedTab = (windowId: string, id: string) => store().restoreArchivedTab(windowId, id);

export const restoreArchivedTabs = (windowId: string, ids: string[]) => store().restoreArchivedTabs(windowId, ids);

export const deleteArchivedTab = (id: string) => store().deleteArchivedTab(id);

export const clearArchivedTabs = () => store().clearArchivedTabs();

export const saveSessionWithPrompt = async (windowId: string) => {
  const name = await prompt({ title: "Save Session", value: "", placeholder: "Session name", confirmTitle: "Save", windowId });
  if (name === null) return "";
  const id = store().saveSession(windowId, name);
  if (id) noteSessionSaved();
  return id;
};

export const restoreSession = (id: string, windowId?: string) => {
  store().restoreSession(id, windowId);
  noteSessionRestored();
};

export const renameSession = async (windowId: string, id: string) => {
  const session = store().sessions.find((x) => x.id === id);
  if (!session) return;
  const name = await prompt({ title: "Rename Session", value: session.name, placeholder: session.name, confirmTitle: "Rename", windowId });
  if (name !== null) store().renameSession(id, name);
};

export const deleteSession = (id: string) => store().deleteSession(id);
