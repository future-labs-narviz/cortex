import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const tokyoNightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#0f1117",
      color: "#e1e3eb",
      height: "100%",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-content": {
      caretColor: "#3b82f6",
      fontFamily: "var(--font-family)",
      fontSize: "var(--font-size)",
      lineHeight: "var(--line-height)",
      padding: "16px 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#3b82f6",
      borderLeftWidth: "2px",
    },
    ".cm-selectionBackground": {
      backgroundColor: "rgba(59, 130, 246, 0.15) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgba(59, 130, 246, 0.15) !important",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },
    ".cm-gutters": {
      backgroundColor: "#161821",
      color: "#5a5f7a",
      border: "none",
      paddingRight: "8px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      color: "#e1e3eb",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      fontSize: "12px",
      minWidth: "32px",
    },
    ".cm-foldGutter": {
      width: "12px",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(224, 175, 104, 0.3)",
      borderRadius: "4px",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(59, 130, 246, 0.15)",
    },
    ".cm-panels": {
      backgroundColor: "#161821",
      color: "#e1e3eb",
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    },
    ".cm-panel.cm-search": {
      padding: "8px",
    },
    ".cm-panel.cm-search input": {
      backgroundColor: "#0f1117",
      color: "#e1e3eb",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: "4px",
      padding: "4px 8px",
      outline: "none",
    },
    ".cm-panel.cm-search input:focus": {
      borderColor: "#3b82f6",
    },
    ".cm-panel.cm-search button": {
      backgroundColor: "#1e2030",
      color: "#e1e3eb",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: "4px",
      padding: "4px 8px",
      cursor: "pointer",
    },
    ".cm-panel.cm-search button:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
    ".cm-panel.cm-search label": {
      color: "#a0aec0",
      fontSize: "12px",
    },
    ".cm-tooltip": {
      backgroundColor: "#161821",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: "6px",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li": {
        padding: "4px 8px",
      },
      "& > ul > li[aria-selected]": {
        backgroundColor: "rgba(59, 130, 246, 0.15)",
        color: "#e1e3eb",
      },
    },
    // Markdown heading styles
    ".cm-header-1": {
      fontSize: "1.6em",
      fontWeight: "700",
      lineHeight: "1.4",
    },
    ".cm-header-2": {
      fontSize: "1.4em",
      fontWeight: "600",
      lineHeight: "1.4",
    },
    ".cm-header-3": {
      fontSize: "1.2em",
      fontWeight: "600",
      lineHeight: "1.4",
    },
    ".cm-header-4": {
      fontSize: "1.1em",
      fontWeight: "600",
    },
    ".cm-header-5": {
      fontSize: "1.05em",
      fontWeight: "600",
    },
    ".cm-header-6": {
      fontSize: "1em",
      fontWeight: "600",
    },
    // Frontmatter styling
    ".cm-frontmatter": {
      backgroundColor: "rgba(59, 130, 246, 0.15)",
    },
  },
  { dark: true }
);

const tokyoNightHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: "#7aa2f7", fontWeight: "bold" },
  { tag: tags.heading2, color: "#7aa2f7", fontWeight: "bold" },
  { tag: tags.heading3, color: "#7aa2f7", fontWeight: "bold" },
  { tag: tags.heading4, color: "#7aa2f7", fontWeight: "bold" },
  { tag: tags.heading5, color: "#7aa2f7", fontWeight: "bold" },
  { tag: tags.heading6, color: "#7aa2f7", fontWeight: "bold" },
  { tag: tags.strong, color: "#ff9e64", fontWeight: "bold" },
  { tag: tags.emphasis, color: "#bb9af7", fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "#565f89" },
  { tag: tags.link, color: "#73daca", textDecoration: "underline" },
  { tag: tags.url, color: "#73daca" },
  {
    tag: tags.monospace,
    color: "#9ece6a",
    backgroundColor: "rgba(158, 206, 106, 0.1)",
    borderRadius: "3px",
    padding: "1px 4px",
  },
  { tag: tags.comment, color: "#565f89" },
  { tag: tags.meta, color: "#565f89" },
  { tag: tags.keyword, color: "#bb9af7" },
  { tag: tags.string, color: "#9ece6a" },
  { tag: tags.number, color: "#ff9e64" },
  { tag: tags.bool, color: "#ff9e64" },
  { tag: tags.operator, color: "#89ddff" },
  { tag: tags.punctuation, color: "#89ddff" },
  { tag: tags.bracket, color: "#a9b1d6" },
  { tag: tags.className, color: "#7aa2f7" },
  { tag: tags.function(tags.variableName), color: "#7aa2f7" },
  { tag: tags.definition(tags.variableName), color: "#c0caf5" },
  { tag: tags.propertyName, color: "#73daca" },
  { tag: tags.typeName, color: "#2ac3de" },
  { tag: tags.variableName, color: "#c0caf5" },
  { tag: tags.quote, color: "#565f89", fontStyle: "italic" },
  { tag: tags.processingInstruction, color: "#565f89" },
]);

export const tokyoNight = [
  tokyoNightTheme,
  syntaxHighlighting(tokyoNightHighlightStyle),
];
