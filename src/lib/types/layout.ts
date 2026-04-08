import type { EditorTab, SidebarPanel } from "./index";

// ── Identifiers ──────────────────────────────────────────────

export type SheetId = string; // crypto.randomUUID()

// ── View modes for file sheets ───────────────────────────────

export type ViewMode = "edit" | "preview" | "split";

// ── Sheet content discriminated union ────────────────────────

export type SheetContent =
  | { kind: "file"; viewMode: ViewMode }
  | { kind: "graph" }
  | { kind: "panel"; panel: SidebarPanel }
  | { kind: "empty" };

// ── Sheet: the fundamental layout unit ───────────────────────

export interface Sheet {
  id: SheetId;
  content: SheetContent;
  tabs: EditorTab[];          // meaningful only when content.kind === "file"
  activeTabId: string | null;
}

// ── Recursive layout tree ────────────────────────────────────

export type LayoutNode =
  | { type: "sheet"; sheetId: SheetId }
  | {
      type: "split";
      direction: "horizontal" | "vertical";
      ratio: number; // 0–1, left/top child gets this fraction
      children: [LayoutNode, LayoutNode];
    };

// ── Layout state (stored in layoutStore) ─────────────────────

export interface LayoutState {
  root: LayoutNode;
  sheets: Record<SheetId, Sheet>;
  activeSheetId: SheetId;
}
