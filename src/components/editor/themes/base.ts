import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const tokyoNightTheme = EditorView.theme(
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
      caretColor: "var(--accent)",
      fontFamily: "var(--font-family)",
      fontSize: "var(--font-size)",
      lineHeight: "var(--line-height)",
      padding: "16px 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--accent)",
      borderLeftWidth: "2px",
    },
    ".cm-selectionBackground": {
      backgroundColor: "var(--accent-soft) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--accent-soft) !important",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--muted)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--bg-secondary)",
      color: "var(--text-muted)",
      border: "none",
      paddingRight: "8px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--muted)",
      color: "var(--text-primary)",
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
      backgroundColor: "var(--accent-soft)",
    },
    ".cm-panels": {
      backgroundColor: "var(--bg-secondary)",
      color: "var(--text-primary)",
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: "1px solid var(--border)",
    },
    ".cm-panel.cm-search": {
      padding: "8px",
    },
    ".cm-panel.cm-search input": {
      backgroundColor: "var(--bg-primary)",
      color: "var(--text-primary)",
      border: "1px solid var(--border)",
      borderRadius: "4px",
      padding: "4px 8px",
      outline: "none",
    },
    ".cm-panel.cm-search input:focus": {
      borderColor: "var(--accent)",
    },
    ".cm-panel.cm-search button": {
      backgroundColor: "var(--bg-tertiary)",
      color: "var(--text-primary)",
      border: "1px solid var(--border)",
      borderRadius: "4px",
      padding: "4px 8px",
      cursor: "pointer",
    },
    ".cm-panel.cm-search button:hover": {
      backgroundColor: "var(--muted-hover)",
    },
    ".cm-panel.cm-search label": {
      color: "var(--text-secondary)",
      fontSize: "12px",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: "6px",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li": {
        padding: "4px 8px",
      },
      "& > ul > li[aria-selected]": {
        backgroundColor: "var(--accent-soft)",
        color: "var(--text-primary)",
      },
    },
    // Markdown heading styles — clear hierarchy
    ".cm-header-1": {
      fontSize: "1.8em",
      fontWeight: "700",
      lineHeight: "1.3",
    },
    ".cm-header-2": {
      fontSize: "1.4em",
      fontWeight: "600",
      lineHeight: "1.35",
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
      backgroundColor: "var(--accent-soft)",
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
