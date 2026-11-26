import { chooseFromMenu } from "../app/menuChoice";
import { useBrowser } from "../browser/store";
import { sep } from "../sidebar/menuParts";
import { restoreSession, saveSessionWithPrompt } from "./actions";

type SessionChoice = { restore: string };

export async function openRestoreSessionMenu(windowId: string) {
  const sessions = useBrowser.getState().sessions;
  const choice = await chooseFromMenu<SessionChoice, string>([
    { id: "save", title: "Save Current Window as Session…", symbol: "square.and.arrow.down" },
    sep,
    ...(sessions.length
      ? sessions.map((x) => ({ value: { restore: x.id }, title: `${x.name} (${x.closedWindow.tabs.length} tab${x.closedWindow.tabs.length === 1 ? "" : "s"})` }))
      : [{ id: "none", title: "No Saved Sessions", enabled: false }]),
  ]);
  if (!choice) return;
  if (typeof choice === "string") {
    if (choice === "save") void saveSessionWithPrompt(windowId);
    return;
  }
  restoreSession(choice.restore, windowId);
}
