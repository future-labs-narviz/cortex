/**
 * @deprecated — Use `useLayoutStore` from "@/stores/layoutStore" instead.
 *
 * This is a backward-compatibility facade that delegates to the layout store.
 * It will be removed once all consumers are migrated.
 */
import { create } from "zustand";
import type { EditorTab } from "@/lib/types";
import { useLayoutStore } from "./layoutStore";

export type SplitDirection = "none" | "horizontal" | "vertical";

export interface Pane {
  tabs: EditorTab[];
  activeTabId: string | null;
}

interface EditorStore {
  // Split view state (legacy)
  splitDirection: SplitDirection;
  splitRatio: number;
  panes: Pane[];
  activePaneIndex: number;

  // Split actions
  setSplit: (direction: SplitDirection) => void;
  setSplitRatio: (ratio: number) => void;
  setActivePane: (index: number) => void;

  // Tab actions (operate on the active sheet)
  tabs: EditorTab[];
  activeTabId: string | null;
  openTab: (path: string, content: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  markSaved: (id: string, content: string) => void;
  getActiveTab: () => EditorTab | null;
}

/**
 * Facade store that derives state from layoutStore.
 *
 * - panes[0] is always the active sheet's tabs.
 * - splitDirection / splitRatio are derived from the layout tree.
 * - All mutations delegate to layoutStore.
 */
export const useEditorStore = create<EditorStore>((set, get) => {
  // Subscribe to layout store changes and sync derived state
  const syncFromLayout = () => {
    const layout = useLayoutStore.getState();
    const sheet = layout.sheets[layout.activeSheetId];
    const tabs = sheet?.tabs ?? [];
    const activeTabId = sheet?.activeTabId ?? null;

    // Derive split info from root node
    let splitDirection: SplitDirection = "none";
    let splitRatio = 0.5;
    if (layout.root.type === "split") {
      splitDirection = layout.root.direction;
      splitRatio = layout.root.ratio;
    }

    // Build panes array from all sheets in order
    const sheetIds = layout.getSheetIds();
    const panes: Pane[] = sheetIds.map((id) => {
      const s = layout.sheets[id];
      return {
        tabs: s?.tabs ?? [],
        activeTabId: s?.activeTabId ?? null,
      };
    });
    const activePaneIndex = Math.max(
      0,
      sheetIds.indexOf(layout.activeSheetId),
    );

    set({
      splitDirection,
      splitRatio,
      panes,
      activePaneIndex,
      tabs,
      activeTabId,
    });
  };

  // Subscribe to layout store
  useLayoutStore.subscribe(syncFromLayout);

  // Compute initial state
  const layout = useLayoutStore.getState();
  const sheet = layout.sheets[layout.activeSheetId];
  const sheetIds = layout.getSheetIds();

  return {
    splitDirection: layout.root.type === "split" ? layout.root.direction : "none",
    splitRatio: layout.root.type === "split" ? layout.root.ratio : 0.5,
    panes: sheetIds.map((id) => {
      const s = layout.sheets[id];
      return { tabs: s?.tabs ?? [], activeTabId: s?.activeTabId ?? null };
    }),
    activePaneIndex: Math.max(0, sheetIds.indexOf(layout.activeSheetId)),
    tabs: sheet?.tabs ?? [],
    activeTabId: sheet?.activeTabId ?? null,

    setSplit: (direction) => {
      const layout = useLayoutStore.getState();
      if (direction === "none") {
        // Close all sheets except active, merge tabs concept doesn't apply directly
        // For compat: just close extra sheets
        const ids = layout.getSheetIds();
        for (const id of ids) {
          if (id !== layout.activeSheetId) {
            layout.closeSheet(id);
          }
        }
      } else {
        layout.splitSheet(layout.activeSheetId, direction);
      }
    },

    setSplitRatio: (ratio) => {
      const layout = useLayoutStore.getState();
      layout.setSplitRatio(layout.activeSheetId, ratio);
    },

    setActivePane: (index) => {
      const layout = useLayoutStore.getState();
      const ids = layout.getSheetIds();
      if (index >= 0 && index < ids.length) {
        layout.setActiveSheet(ids[index]);
      }
    },

    openTab: (path, content) => {
      useLayoutStore.getState().openTab(path, content);
    },

    closeTab: (id) => {
      const layout = useLayoutStore.getState();
      layout.closeTab(layout.activeSheetId, id);
    },

    setActiveTab: (id) => {
      const layout = useLayoutStore.getState();
      layout.setActiveTab(layout.activeSheetId, id);
    },

    updateContent: (id, content) => {
      useLayoutStore.getState().updateContent(id, content);
    },

    markSaved: (id, content) => {
      useLayoutStore.getState().markSaved(id, content);
    },

    getActiveTab: () => {
      return useLayoutStore.getState().getActiveTab();
    },
  };
});
