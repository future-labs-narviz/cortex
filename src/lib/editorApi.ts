import type { EditorView } from "@codemirror/view";

export interface EditorAPI {
  insertAtCursor(text: string): void;
  replaceSelection(text: string): void;
  getContent(): string;
  getCurrentNoteId(): string | null;
  focus(): void;
}

let currentView: EditorView | null = null;
let currentNoteId: string | null = null;

export function setEditorView(view: EditorView | null) {
  currentView = view;
}

export function setCurrentNoteId(id: string | null) {
  currentNoteId = id;
}

export function getEditorView(): EditorView | null {
  return currentView;
}

export const editorApi: EditorAPI = {
  insertAtCursor(text: string) {
    if (!currentView) return;
    const { from } = currentView.state.selection.main;
    currentView.dispatch({
      changes: { from, insert: text },
      selection: { anchor: from + text.length },
    });
  },

  replaceSelection(text: string) {
    if (!currentView) return;
    currentView.dispatch(currentView.state.replaceSelection(text));
  },

  getContent(): string {
    if (!currentView) return "";
    return currentView.state.doc.toString();
  },

  getCurrentNoteId(): string | null {
    return currentNoteId;
  },

  focus() {
    currentView?.focus();
  },
};
