import { EditorView } from "@codemirror/view";

/**
 * CM6 theme for read-only preview mode.
 *
 * Hides editor chrome (cursor, gutters, active line), increases
 * line height for comfortable reading, and adds content padding.
 */
export const previewTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--bg-primary)",
      color: "var(--text-primary)",
      height: "100%",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-content": {
      fontFamily: "var(--font-family)",
      fontSize: "var(--font-size)",
      lineHeight: "1.8",
      padding: "24px 32px",
      caretColor: "transparent",
    },
    // Hide cursor in preview
    ".cm-cursor, .cm-dropCursor": {
      display: "none",
    },
    // No active line highlight
    ".cm-activeLine": {
      backgroundColor: "transparent",
    },
    // Hide gutters entirely
    ".cm-gutters": {
      display: "none",
    },
    // Hide selection background in preview
    ".cm-selectionBackground": {
      backgroundColor: "transparent !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "transparent !important",
    },
    // Frontmatter styling
    ".cm-frontmatter": {
      backgroundColor: "var(--accent-soft)",
      borderTop: "1px dashed var(--border)",
      borderBottom: "1px dashed var(--border)",
    },
    // Tooltips (for widgets that show tooltips)
    ".cm-tooltip": {
      backgroundColor: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: "6px",
    },
  },
  { dark: true },
);
