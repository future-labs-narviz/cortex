import type { EditorView } from "@codemirror/view";
import type { SheetId } from "@/lib/types/layout";

export interface EditorAPI {
  insertAtCursor(text: string): void;
  replaceSelection(text: string): void;
  getContent(): string;
  getCurrentNoteId(): string | null;
  focus(): void;
}

/** Map of sheet ID → EditorView for multi-sheet support */
const viewMap = new Map<SheetId, EditorView>();
let activeSheetId: SheetId | null = null;
let currentNoteId: string | null = null;

export function registerEditorView(sheetId: SheetId, view: EditorView) {
  viewMap.set(sheetId, view);
}

export function unregisterEditorView(sheetId: SheetId) {
  viewMap.delete(sheetId);
}

export function setActiveEditorSheet(sheetId: SheetId | null) {
  activeSheetId = sheetId;
}

export function setCurrentNoteId(id: string | null) {
  currentNoteId = id;
}

export function getEditorView(): EditorView | null {
  if (activeSheetId) {
    return viewMap.get(activeSheetId) ?? null;
  }
  // Fallback: return the first (and possibly only) view
  const first = viewMap.values().next();
  return first.done ? null : first.value;
}

/** @deprecated Use registerEditorView/unregisterEditorView instead */
export function setEditorView(view: EditorView | null) {
  // Backward compat: register/unregister with a legacy key
  if (view) {
    viewMap.set("__legacy__", view);
  } else {
    viewMap.delete("__legacy__");
  }
}

export const editorApi: EditorAPI = {
  insertAtCursor(text: string) {
    const view = getEditorView();
    if (!view) return;
    const { from } = view.state.selection.main;
    view.dispatch({
      changes: { from, insert: text },
      selection: { anchor: from + text.length },
    });
  },

  replaceSelection(text: string) {
    const view = getEditorView();
    if (!view) return;
    view.dispatch(view.state.replaceSelection(text));
  },

  getContent(): string {
    const view = getEditorView();
    if (!view) return "";
    return view.state.doc.toString();
  },

  getCurrentNoteId(): string | null {
    return currentNoteId;
  },

  focus() {
    getEditorView()?.focus();
  },
};
