import { chooseFromMenu } from "../app/menuChoice";
import { activeTabId, inPinnedContainer } from "../browser/model";
import { useBrowser } from "../browser/store";
import { GROUP_COLOR_ORDER, GROUP_COLORS, type GroupTint } from "../groups/tokens";
import { sep } from "../sidebar/menuParts";
import { deleteSpace, moveTabsToSpace, newTabInSpace, renameSpace, setSpaceColor } from "./actions";

type SpaceChoice = { color: GroupTint } | { moveCurrent: true };

export async function openSpaceMenu(windowId: string, spaceId: string) {
  const s = useBrowser.getState();
  const space = s.spaces[spaceId];
  if (!space) return;
  const current = activeTabId(s, windowId);
  const canMoveCurrent = !!current && !inPinnedContainer(s, current);
  const choice = await chooseFromMenu<SpaceChoice, string>([
    { id: "rename", title: "Rename…", symbol: "pencil" },
    {
      id: "color",
      title: "Change Color",
      symbol: "paintpalette",
      children: GROUP_COLOR_ORDER.map((color) => ({ value: { color }, title: GROUP_COLORS[color].name, swatch: GROUP_COLORS[color].hex, checked: space.color === color })),
    },
    sep,
    { id: "newTab", title: "New Tab in Space", symbol: "plus" },
    { title: "Move Current Tab Here", symbol: "arrow.right.square", enabled: canMoveCurrent, value: { moveCurrent: true } },
    sep,
    { id: "delete", title: "Delete Space", symbol: "trash" },
  ]);
  if (!choice) return;
  if (typeof choice !== "string") {
    if ("color" in choice) setSpaceColor(spaceId, choice.color);
    else if (current) moveTabsToSpace(windowId, [current], spaceId);
    return;
  }
  if (choice === "rename") void renameSpace(windowId, spaceId);
  else if (choice === "newTab") newTabInSpace(windowId, spaceId);
  else if (choice === "delete") deleteSpace(spaceId);
}
