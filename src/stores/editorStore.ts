import { create } from "zustand";
import type { EditorTab } from "@/lib/types";

export type SplitDirection = "none" | "horizontal" | "vertical";

export interface Pane {
  tabs: EditorTab[];
  activeTabId: string | null;
}

interface EditorStore {
  // Split view state
  splitDirection: SplitDirection;
  splitRatio: number;
  panes: Pane[];
  activePaneIndex: number;

  // Split actions
  setSplit: (direction: SplitDirection) => void;
  setSplitRatio: (ratio: number) => void;
  setActivePane: (index: number) => void;

  // Tab actions (operate on the active pane)
  tabs: EditorTab[];
  activeTabId: string | null;
  openTab: (path: string, content: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  markSaved: (id: string, content: string) => void;
  getActiveTab: () => EditorTab | null;
}

function fileNameFromPath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function titleFromFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
}

function createTab(path: string, content: string): EditorTab {
  const fileName = fileNameFromPath(path);
  return {
    id: path,
    filePath: path,
    fileName,
    title: titleFromFileName(fileName),
    content,
    savedContent: content,
    isDirty: false,
  };
}

function getActivePane(state: { panes: Pane[]; activePaneIndex: number }): Pane {
  return state.panes[state.activePaneIndex] ?? state.panes[0];
}

/** Derive legacy tabs/activeTabId from active pane for backward compat */
function withLegacy(
  update: Partial<{ panes: Pane[]; activePaneIndex: number }>,
  state: { panes: Pane[]; activePaneIndex: number },
): Partial<EditorStore> {
  const panes = update.panes ?? state.panes;
  const idx = update.activePaneIndex ?? state.activePaneIndex;
  const pane = panes[idx] ?? panes[0];
  return {
    ...update,
    tabs: pane?.tabs ?? [],
    activeTabId: pane?.activeTabId ?? null,
  };
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  // Split view
  splitDirection: "none",
  splitRatio: 0.5,
  panes: [{ tabs: [], activeTabId: null }],
  activePaneIndex: 0,

  // Legacy compatibility: these are computed from the active pane.
  // Components should prefer reading from panes[activePaneIndex] directly.
  tabs: [],
  activeTabId: null,

  setSplit: (direction: SplitDirection) =>
    set((state) => {
      if (direction === "none") {
        // Merge all tabs into pane 0
        const allTabs: EditorTab[] = [];
        const seen = new Set<string>();
        for (const pane of state.panes) {
          for (const tab of pane.tabs) {
            if (!seen.has(tab.id)) {
              allTabs.push(tab);
              seen.add(tab.id);
            }
          }
        }
        const activeId =
          state.panes[state.activePaneIndex]?.activeTabId ??
          allTabs[0]?.id ??
          null;
        const update = {
          splitDirection: "none" as const,
          splitRatio: 0.5,
          panes: [{ tabs: allTabs, activeTabId: activeId }],
          activePaneIndex: 0,
        };
        return withLegacy(update, { ...state, ...update });
      }

      // Split: if currently one pane, create empty second pane
      if (state.panes.length < 2) {
        const update = {
          splitDirection: direction,
          panes: [...state.panes, { tabs: [], activeTabId: null }],
        };
        return withLegacy(update, { ...state, ...update });
      }

      // Already split, just change direction
      return { splitDirection: direction };
    }),

  setSplitRatio: (ratio: number) =>
    set({ splitRatio: Math.max(0.15, Math.min(0.85, ratio)) }),

  setActivePane: (index: number) =>
    set((state) => {
      if (index < 0 || index >= state.panes.length) return {};
      const update = { activePaneIndex: index };
      return withLegacy(update, { ...state, ...update });
    }),

  openTab: (path: string, content: string) =>
    set((state) => {
      const paneIdx = state.activePaneIndex;
      const pane = state.panes[paneIdx];
      if (!pane) return {};

      const existing = pane.tabs.find((t) => t.id === path);
      if (existing) {
        const newPanes = [...state.panes];
        newPanes[paneIdx] = { ...pane, activeTabId: path };
        const update = { panes: newPanes };
        return withLegacy(update, { ...state, ...update });
      }

      const newTab = createTab(path, content);
      const newPanes = [...state.panes];
      newPanes[paneIdx] = {
        tabs: [...pane.tabs, newTab],
        activeTabId: path,
      };
      const update = { panes: newPanes };
      return withLegacy(update, { ...state, ...update });
    }),

  closeTab: (id: string) =>
    set((state) => {
      const paneIdx = state.activePaneIndex;
      const pane = state.panes[paneIdx];
      if (!pane) return {};

      const idx = pane.tabs.findIndex((t) => t.id === id);
      const newTabs = pane.tabs.filter((t) => t.id !== id);
      let newActiveId = pane.activeTabId;

      if (pane.activeTabId === id) {
        if (newTabs.length === 0) {
          newActiveId = null;
        } else if (idx < newTabs.length) {
          newActiveId = newTabs[idx].id;
        } else {
          newActiveId = newTabs[newTabs.length - 1].id;
        }
      }

      const newPanes = [...state.panes];
      newPanes[paneIdx] = { tabs: newTabs, activeTabId: newActiveId };
      const update = { panes: newPanes };
      return withLegacy(update, { ...state, ...update });
    }),

  setActiveTab: (id: string) =>
    set((state) => {
      const paneIdx = state.activePaneIndex;
      const pane = state.panes[paneIdx];
      if (!pane) return {};

      const newPanes = [...state.panes];
      newPanes[paneIdx] = { ...pane, activeTabId: id };
      const update = { panes: newPanes };
      return withLegacy(update, { ...state, ...update });
    }),

  updateContent: (id: string, content: string) =>
    set((state) => {
      const newPanes = state.panes.map((pane) => ({
        ...pane,
        tabs: pane.tabs.map((t) =>
          t.id === id
            ? { ...t, content, isDirty: content !== t.savedContent }
            : t,
        ),
      }));
      const update = { panes: newPanes };
      return withLegacy(update, { ...state, ...update });
    }),

  markSaved: (id: string, content: string) =>
    set((state) => {
      const newPanes = state.panes.map((pane) => ({
        ...pane,
        tabs: pane.tabs.map((t) =>
          t.id === id ? { ...t, savedContent: content, isDirty: false } : t,
        ),
      }));
      const update = { panes: newPanes };
      return withLegacy(update, { ...state, ...update });
    }),

  getActiveTab: () => {
    const state = get();
    const pane = getActivePane(state);
    return pane.tabs.find((t) => t.id === pane.activeTabId) ?? null;
  },
}));
