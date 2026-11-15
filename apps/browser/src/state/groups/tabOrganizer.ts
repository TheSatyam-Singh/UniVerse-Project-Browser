import {
  buildPlan,
  classifyWithProvider,
  createProvider,
  duplicatesIn,
  planSummary,
  rulesGroups,
  rulesRenames,
  type AIConfiguration,
  type TabInput,
} from "@universe/ai";
import type { StateCreator } from "zustand";
import type { BrowserState } from "../browser/store";
import { tabTitle } from "../browser/model";
import { focusedWindowOf } from "../windows/ui";
import { configFromSettings } from "../ai/assistant";
import { getAiApiKey } from "../ai/keyStore";

export type TabOrganizerSlice = {
  isOrganizing: boolean;
  organizerError: string | null;
  canUndoOrganizer: boolean;
  lastOrganizeSummary: string | null;
  organizeTabs: (windowId?: string) => Promise<void>;
  undoLastOrganization: () => void;
};

type OrganizerUndo = {
  windowId: string;
  memberships: { tabId: string; groupId: string | null }[];
  customTitles: { tabId: string; customTitle: string | null }[];
  closedTabs: { id: string; url: string; title: string }[];
  createdGroupIds: string[];
};

let lastUndo: OrganizerUndo | null = null;

function groupOfTab(s: BrowserState, tabId: string): string | null {
  for (const group of Object.values(s.groups)) {
    if (group.tabIds.includes(tabId)) return group.id;
  }
  return null;
}

export function organizerInputs(s: BrowserState, windowId: string): TabInput[] {
  const w = s.windows[windowId];
  if (!w) return [];
  const grouped = new Set(Object.values(s.groups).flatMap((g) => g.tabIds));
  const inputs: TabInput[] = [];
  for (const tabId of w.tabIds) {
    if (grouped.has(tabId)) continue;
    const tab = s.tabs[tabId];
    if (!tab || !tab.url || !tab.title) continue;
    inputs.push({ index: inputs.length + 1, id: tabId, title: tabTitle(tab), url: tab.url });
  }
  return inputs;
}

function providerChat(config: AIConfiguration): ((args: { messages: { role: "system" | "user" | "assistant" | "tool"; content: string }[]; model: string }) => Promise<{ content: string; toolCalls: []; citations: []; finishReason: "stop" }>) | null {
  const provider = config.providers.find((p) => p.id === config.activeProviderId);
  if (!provider || !config.activeModelId) return null;
  if (provider.providerType === "apple_intelligence") return null;
  if (provider.providerType !== "ollama" && !getAiApiKey(provider.id)) return null;
  const instance = createProvider({ provider, apiKey: getAiApiKey(provider.id), platform: { os: "darwin" } });
  if (!instance) return null;
  return async ({ messages, model }) => {
    const response = await instance.sendMessage({
      messages,
      model,
      config: config.generationConfig,
      tools: [],
      onStream: () => {},
    });
    return { content: response.content, toolCalls: [], citations: [], finishReason: "stop" as const };
  };
}

export const createTabOrganizerSlice: StateCreator<BrowserState, [], [], TabOrganizerSlice> = (set, get) => ({
  isOrganizing: false,
  organizerError: null,
  canUndoOrganizer: false,
  lastOrganizeSummary: null,

  async organizeTabs(windowId) {
    const s = get();
    if (s.isOrganizing) return;
    const target = windowId ?? focusedWindowOf(s);
    if (!target) return;
    const inputs = organizerInputs(s, target);
    if (inputs.length < 3) {
      set({ organizerError: `Need at least 3 unfiled tabs to organize (found ${inputs.length}).` });
      return;
    }
    if (inputs.length > 40) {
      set({ organizerError: `Too many tabs (${inputs.length}). Maximum is 40.` });
      return;
    }
    set({ isOrganizing: true, organizerError: null });
    try {
      const state = get();
      const folders = Object.values(state.groups)
        .filter((g) => g.windowId === target)
        .map((g) => ({
          id: g.id,
          name: g.name,
          sampleTitles: g.tabIds.slice(0, 10).map((id) => (state.tabs[id] ? tabTitle(state.tabs[id]) : "")).filter(Boolean),
        }));
      const filedUrls = Object.values(state.groups)
        .filter((g) => g.windowId === target)
        .flatMap((g) => g.tabIds)
        .map((id) => state.tabs[id]?.url)
        .filter((url): url is string => !!url);
      const duplicates = duplicatesIn(inputs, filedUrls);
      const kept = inputs.filter((input) => !duplicates.includes(input.index));
      const config = configFromSettings(state.settings);
      const chat = state.settings.tabOrganizerEnabled ? providerChat(config) : null;
      let groups = rulesGroups(kept, folders);
      let renames = rulesRenames(kept.filter((input) => input.title.length > 24));
      if (chat && config.activeModelId) {
        try {
          const classified = await classifyWithProvider(kept, folders, config.activeModelId, chat);
          if (classified.groups.length > 0) groups = classified.groups;
          if (classified.renames.length > 0) renames = classified.renames;
        } catch {
          groups = rulesGroups(kept, folders);
          renames = rulesRenames(kept.filter((input) => input.title.length > 24));
        }
      }
      const plan = buildPlan(inputs, groups, renames, duplicates);
      const before = get();
      const undo: OrganizerUndo = {
        windowId: target,
        memberships: kept.map((input) => ({ tabId: input.id, groupId: groupOfTab(before, input.id) })),
        customTitles: kept.map((input) => ({ tabId: input.id, customTitle: before.tabs[input.id]?.customTitle ?? null })),
        closedTabs: duplicates
          .map((index) => inputs.find((input) => input.index === index))
          .filter((input): input is TabInput => !!input)
          .map((input) => ({ id: input.id, url: input.url, title: input.title })),
        createdGroupIds: [],
      };
      for (const group of plan.groups) {
        const tabIds = group.tabs.map((index) => inputs.find((input) => input.index === index)?.id).filter((id): id is string => !!id);
        if (tabIds.length === 0) continue;
        if (group.existingFolderId && get().groups[group.existingFolderId]) {
          get().addTabsToGroup(group.existingFolderId, tabIds);
        } else {
          const created = get().createGroup(tabIds, { name: group.name });
          if (created) undo.createdGroupIds.push(created);
        }
      }
      for (const rename of plan.renames) {
        const input = inputs.find((item) => item.index === rename.tab);
        if (input) get().updateTab(input.id, { customTitle: rename.name });
      }
      const duplicateIds = plan.duplicates.map((index) => inputs.find((input) => input.index === index)?.id).filter((id): id is string => !!id);
      if (duplicateIds.length > 0) get().closeTabs(duplicateIds);
      lastUndo = undo;
      set({ isOrganizing: false, canUndoOrganizer: true, lastOrganizeSummary: planSummary(plan) });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      set({ isOrganizing: false, organizerError: detail });
    }
  },

  undoLastOrganization() {
    if (!lastUndo) return;
    const undo = lastUndo;
    lastUndo = null;
    for (const { tabId, groupId } of undo.memberships) {
      if (!get().tabs[tabId]) continue;
      get().removeTabsFromGroup([tabId]);
      if (groupId && get().groups[groupId]) get().addTabsToGroup(groupId, [tabId]);
    }
    for (const createdId of undo.createdGroupIds) {
      if (get().groups[createdId]) get().ungroup(createdId);
    }
    for (const { tabId, customTitle } of undo.customTitles) {
      if (get().tabs[tabId]) get().updateTab(tabId, { customTitle });
    }
    const reopen = undo.closedTabs.filter((tab) => !get().tabs[tab.id]);
    if (reopen.length > 0) {
      for (const tab of reopen) {
        const id = get().newTab(undo.windowId, { url: tab.url });
        get().updateTab(id, { title: tab.title });
      }
    }
    set({ canUndoOrganizer: false, lastOrganizeSummary: null });
  },
});
