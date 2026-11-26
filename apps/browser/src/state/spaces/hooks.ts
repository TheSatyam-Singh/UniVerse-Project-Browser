import { useShallow } from "zustand/react/shallow";
import { useBrowser } from "../browser/store";
import { activeSpaceOf, spacesOf, type Space } from "./spaces";
import type { ArchivedTab } from "./archived";
import type { SavedSession } from "./sessions";

export const useSpaces = (windowId: string): Space[] => useBrowser(useShallow((s) => spacesOf(s, windowId)));

export const useActiveSpaceId = (windowId: string): string | null => useBrowser((s) => s.activeSpaceId[windowId] ?? null);

export const useActiveSpace = (windowId: string): Space | null => useBrowser((s) => activeSpaceOf(s, windowId));

export const useArchivedTabs = (): ArchivedTab[] => useBrowser((s) => s.archivedTabs);

export const useSessions = (): SavedSession[] => useBrowser((s) => s.sessions);
