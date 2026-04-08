import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EditorTab } from "@/lib/types";
import type {
  SheetId,
  ViewMode,
  SheetContent,
  Sheet,
  LayoutNode,
  LayoutState,
} from "@/lib/types/layout";

// ── Helpers ──────────────────────────────────────────────────

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

function createSheet(content: SheetContent): Sheet {
  return {
    id: crypto.randomUUID(),
    content,
    tabs: [],
    activeTabId: null,
  };
}

/** Count leaf (sheet) nodes in the layout tree */
function countSheets(node: LayoutNode): number {
  if (node.type === "sheet") return 1;
  return countSheets(node.children[0]) + countSheets(node.children[1]);
}

/** Replace a sheet node in the tree by ID, returning a new tree */
function replaceSheetNode(
  node: LayoutNode,
  sheetId: SheetId,
  replacement: LayoutNode,
): LayoutNode {
  if (node.type === "sheet") {
    return node.sheetId === sheetId ? replacement : node;
  }
  return {
    ...node,
    children: [
      replaceSheetNode(node.children[0], sheetId, replacement),
      replaceSheetNode(node.children[1], sheetId, replacement),
    ],
  };
}

/** Remove a sheet node from the tree, returning its sibling (collapses the split) */
function removeSheetNode(
  node: LayoutNode,
  sheetId: SheetId,
): LayoutNode | null {
  if (node.type === "sheet") {
    return node.sheetId === sheetId ? null : node;
  }
  const [left, right] = node.children;
  if (left.type === "sheet" && left.sheetId === sheetId) return right;
  if (right.type === "sheet" && right.sheetId === sheetId) return left;
  // Recurse into children
  const newLeft = removeSheetNode(left, sheetId);
  if (newLeft !== left && newLeft !== null) {
    return { ...node, children: [newLeft, right] };
  }
  const newRight = removeSheetNode(right, sheetId);
  if (newRight !== right && newRight !== null) {
    return { ...node, children: [left, newRight] };
  }
  return node;
}

/** Collect all sheet IDs in order (left-to-right / top-to-bottom) */
function collectSheetIds(node: LayoutNode): SheetId[] {
  if (node.type === "sheet") return [node.sheetId];
  return [
    ...collectSheetIds(node.children[0]),
    ...collectSheetIds(node.children[1]),
  ];
}

/** Find the parent split node that contains a given sheetId, and update its ratio */
function updateSplitRatio(
  node: LayoutNode,
  sheetId: SheetId,
  ratio: number,
): LayoutNode {
  if (node.type === "sheet") return node;
  const [left, right] = node.children;
  // Check if this split directly contains the target sheet
  const leftIds = collectSheetIds(left);
  if (leftIds.includes(sheetId) || collectSheetIds(right).includes(sheetId)) {
    // Only update if this is the direct parent
    if (
      (left.type === "sheet" && left.sheetId === sheetId) ||
      (right.type === "sheet" && right.sheetId === sheetId)
    ) {
      return { ...node, ratio };
    }
  }
  return {
    ...node,
    children: [
      updateSplitRatio(left, sheetId, ratio),
      updateSplitRatio(right, sheetId, ratio),
    ],
  };
}

// ── Store interface ──────────────────────────────────────────

const MAX_SHEETS = 3;

interface LayoutStore extends LayoutState {
  // Sheet lifecycle
  openFile: (sheetId: SheetId, path: string, content: string) => void;
  closeTab: (sheetId: SheetId, tabId: string) => void;
  setActiveTab: (sheetId: SheetId, tabId: string) => void;
  setActiveSheet: (sheetId: SheetId) => void;
  setViewMode: (sheetId: SheetId, mode: ViewMode) => void;
  updateContent: (tabId: string, content: string) => void;
  markSaved: (tabId: string, content: string) => void;

  // Layout mutations
  splitSheet: (
    sheetId: SheetId,
    direction: "horizontal" | "vertical",
  ) => void;
  closeSheet: (sheetId: SheetId) => void;
  setSplitRatio: (sheetId: SheetId, ratio: number) => void;
  setSheetContent: (sheetId: SheetId, content: SheetContent) => void;

  // Compat bridge (temporary — matches editorStore API)
  getActiveTab: () => EditorTab | null;
  openTab: (path: string, content: string) => void;

  // Utilities
  getSheetIds: () => SheetId[];
}

// ── Initial state ────────────────────────────────────────────

const initialSheet = createSheet({ kind: "empty" });

const initialState: LayoutState = {
  root: { type: "sheet", sheetId: initialSheet.id },
  sheets: { [initialSheet.id]: initialSheet },
  activeSheetId: initialSheet.id,
};

// ── Store ────────────────────────────────────────────────────

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set, get) => ({
  ...initialState,

  // ── Sheet lifecycle ──────────────────────────────────────

  openFile: (sheetId, path, content) =>
    set((state) => {
      const sheet = state.sheets[sheetId];
      if (!sheet) return {};

      // Ensure sheet is in file mode
      const newContent: SheetContent =
        sheet.content.kind === "file"
          ? sheet.content
          : { kind: "file", viewMode: "edit" };

      // Check if tab already open
      const existing = sheet.tabs.find((t) => t.id === path);
      if (existing) {
        return {
          sheets: {
            ...state.sheets,
            [sheetId]: {
              ...sheet,
              content: newContent,
              activeTabId: path,
            },
          },
        };
      }

      const newTab = createTab(path, content);
      return {
        sheets: {
          ...state.sheets,
          [sheetId]: {
            ...sheet,
            content: newContent,
            tabs: [...sheet.tabs, newTab],
            activeTabId: path,
          },
        },
      };
    }),

  closeTab: (sheetId, tabId) =>
    set((state) => {
      const sheet = state.sheets[sheetId];
      if (!sheet) return {};

      const idx = sheet.tabs.findIndex((t) => t.id === tabId);
      const newTabs = sheet.tabs.filter((t) => t.id !== tabId);
      let newActiveId = sheet.activeTabId;

      if (sheet.activeTabId === tabId) {
        if (newTabs.length === 0) {
          newActiveId = null;
        } else if (idx < newTabs.length) {
          newActiveId = newTabs[idx].id;
        } else {
          newActiveId = newTabs[newTabs.length - 1].id;
        }
      }

      // If no tabs left, revert to empty sheet
      const newContent: SheetContent =
        newTabs.length === 0 ? { kind: "empty" } : sheet.content;

      return {
        sheets: {
          ...state.sheets,
          [sheetId]: {
            ...sheet,
            tabs: newTabs,
            activeTabId: newActiveId,
            content: newContent,
          },
        },
      };
    }),

  setActiveTab: (sheetId, tabId) =>
    set((state) => {
      const sheet = state.sheets[sheetId];
      if (!sheet) return {};
      return {
        sheets: {
          ...state.sheets,
          [sheetId]: { ...sheet, activeTabId: tabId },
        },
      };
    }),

  setActiveSheet: (sheetId) =>
    set((state) => {
      if (!state.sheets[sheetId]) return {};
      return { activeSheetId: sheetId };
    }),

  setViewMode: (sheetId, mode) =>
    set((state) => {
      const sheet = state.sheets[sheetId];
      if (!sheet || sheet.content.kind !== "file") return {};
      return {
        sheets: {
          ...state.sheets,
          [sheetId]: {
            ...sheet,
            content: { ...sheet.content, viewMode: mode },
          },
        },
      };
    }),

  updateContent: (tabId, content) =>
    set((state) => {
      const newSheets = { ...state.sheets };
      let changed = false;
      for (const [id, sheet] of Object.entries(newSheets)) {
        const tabIdx = sheet.tabs.findIndex((t) => t.id === tabId);
        if (tabIdx !== -1) {
          const tab = sheet.tabs[tabIdx];
          const newTabs = [...sheet.tabs];
          newTabs[tabIdx] = {
            ...tab,
            content,
            isDirty: content !== tab.savedContent,
          };
          newSheets[id] = { ...sheet, tabs: newTabs };
          changed = true;
        }
      }
      return changed ? { sheets: newSheets } : {};
    }),

  markSaved: (tabId, content) =>
    set((state) => {
      const newSheets = { ...state.sheets };
      let changed = false;
      for (const [id, sheet] of Object.entries(newSheets)) {
        const tabIdx = sheet.tabs.findIndex((t) => t.id === tabId);
        if (tabIdx !== -1) {
          const tab = sheet.tabs[tabIdx];
          const newTabs = [...sheet.tabs];
          newTabs[tabIdx] = {
            ...tab,
            savedContent: content,
            isDirty: false,
          };
          newSheets[id] = { ...sheet, tabs: newTabs };
          changed = true;
        }
      }
      return changed ? { sheets: newSheets } : {};
    }),

  // ── Layout mutations ─────────────────────────────────────

  splitSheet: (sheetId, direction) =>
    set((state) => {
      if (countSheets(state.root) >= MAX_SHEETS) return {};
      if (!state.sheets[sheetId]) return {};

      const newSheet = createSheet({ kind: "empty" });
      const splitNode: LayoutNode = {
        type: "split",
        direction,
        ratio: 0.5,
        children: [
          { type: "sheet", sheetId },
          { type: "sheet", sheetId: newSheet.id },
        ],
      };

      return {
        root: replaceSheetNode(state.root, sheetId, splitNode),
        sheets: {
          ...state.sheets,
          [newSheet.id]: newSheet,
        },
      };
    }),

  closeSheet: (sheetId) =>
    set((state) => {
      const sheetIds = collectSheetIds(state.root);
      // Don't close the last sheet — reset it to empty instead
      if (sheetIds.length <= 1) {
        const sheet = state.sheets[sheetId];
        if (!sheet) return {};
        return {
          sheets: {
            ...state.sheets,
            [sheetId]: {
              ...sheet,
              content: { kind: "empty" },
              tabs: [],
              activeTabId: null,
            },
          },
        };
      }

      const newRoot = removeSheetNode(state.root, sheetId);
      if (!newRoot) return {};

      const { [sheetId]: _removed, ...remainingSheets } = state.sheets;
      const newActiveId =
        state.activeSheetId === sheetId
          ? collectSheetIds(newRoot)[0]
          : state.activeSheetId;

      return {
        root: newRoot,
        sheets: remainingSheets,
        activeSheetId: newActiveId,
      };
    }),

  setSplitRatio: (sheetId, ratio) =>
    set((state) => {
      const clamped = Math.max(0.15, Math.min(0.85, ratio));
      return { root: updateSplitRatio(state.root, sheetId, clamped) };
    }),

  setSheetContent: (sheetId, content) =>
    set((state) => {
      const sheet = state.sheets[sheetId];
      if (!sheet) return {};
      return {
        sheets: {
          ...state.sheets,
          [sheetId]: { ...sheet, content },
        },
      };
    }),

  // ── Compat bridge ────────────────────────────────────────

  getActiveTab: () => {
    const state = get();
    const sheet = state.sheets[state.activeSheetId];
    if (!sheet) return null;
    return sheet.tabs.find((t) => t.id === sheet.activeTabId) ?? null;
  },

  openTab: (path, content) => {
    const state = get();
    state.openFile(state.activeSheetId, path, content);
  },

  // ── Utilities ────────────────────────────────────────────

  getSheetIds: () => {
    return collectSheetIds(get().root);
  },
}),
    {
      name: "cortex-layout",
      partialize: (state) => ({
        root: state.root,
        activeSheetId: state.activeSheetId,
        sheets: Object.fromEntries(
          Object.entries(state.sheets).map(([id, sheet]) => [
            id,
            {
              ...sheet,
              // Strip file content from tabs to keep storage small
              tabs: sheet.tabs.map((t) => ({
                id: t.id,
                filePath: t.filePath,
                fileName: t.fileName,
                title: t.title,
                content: "",
                savedContent: "",
                isDirty: false,
              })),
            },
          ]),
        ),
      }),
    },
  ),
);
