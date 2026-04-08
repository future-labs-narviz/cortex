import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { darkTheme, lightTheme, type ThemeTokens } from "@/themes/tokens";

const editorTheme = EditorView.theme(
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
      transition: "background-color 150ms",
    },
    ".cm-gutters": {
      backgroundColor: "var(--bg-secondary)",
      color: "var(--text-muted)",
      border: "none",
      paddingLeft: "12px",
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
      backgroundColor: "var(--accent-glow)",
      borderRadius: "4px",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "var(--accent-glow)",
      outline: "1px solid var(--accent)",
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
    // Markdown heading styles — gradual hierarchy
    ".cm-header-1": {
      fontSize: "1.6em",
      fontWeight: "700",
      lineHeight: "1.4",
    },
    ".cm-header-2": {
      fontSize: "1.35em",
      fontWeight: "600",
      lineHeight: "1.4",
    },
    ".cm-header-3": {
      fontSize: "1.15em",
      fontWeight: "600",
      lineHeight: "1.4",
    },
    ".cm-header-4": {
      fontSize: "1.05em",
      fontWeight: "600",
      lineHeight: "1.4",
    },
    ".cm-header-5": {
      fontSize: "1em",
      fontWeight: "600",
      lineHeight: "1.4",
    },
    ".cm-header-6": {
      fontSize: "1em",
      fontWeight: "600",
      lineHeight: "1.4",
    },
    // Frontmatter styling
    ".cm-frontmatter": {
      backgroundColor: "var(--accent-soft)",
      borderTop: "1px dashed var(--border)",
      borderBottom: "1px dashed var(--border)",
    },
  },
  { dark: true }
);

// ---------------------------------------------------------------------------
// Theme-aware syntax highlighting
// ---------------------------------------------------------------------------

// Light theme needs its own set of syntax colors that read well on white.
// Dark theme uses Tokyo Night–inspired colors.
interface SyntaxPalette {
  heading: string;
  strong: string;
  emphasis: string;
  strikethrough: string;
  link: string;
  code: string;
  codeBg: string;
  comment: string;
  keyword: string;
  string: string;
  number: string;
  operator: string;
  bracket: string;
  className: string;
  definition: string;
  property: string;
  typeName: string;
  variable: string;
}

const darkSyntax: SyntaxPalette = {
  heading: "#7aa2f7",
  strong: "#ff9e64",
  emphasis: "#bb9af7",
  strikethrough: "#7a85a0",
  link: "#73daca",
  code: "#9ece6a",
  codeBg: "rgba(158, 206, 106, 0.12)",
  comment: "#7a85a0",
  keyword: "#bb9af7",
  string: "#9ece6a",
  number: "#ff9e64",
  operator: "#89ddff",
  bracket: "#a9b1d6",
  className: "#7aa2f7",
  definition: "#c0caf5",
  property: "#73daca",
  typeName: "#2ac3de",
  variable: "#c0caf5",
};

const lightSyntax: SyntaxPalette = {
  heading: lightTheme.accent,
  strong: lightTheme.orange,
  emphasis: lightTheme.purple,
  strikethrough: lightTheme.textMuted,
  link: lightTheme.cyan,
  code: lightTheme.green,
  codeBg: `${lightTheme.green}1a`,
  comment: lightTheme.textMuted,
  keyword: lightTheme.purple,
  string: lightTheme.green,
  number: lightTheme.orange,
  operator: lightTheme.cyan,
  bracket: lightTheme.textSecondary,
  className: lightTheme.accent,
  definition: lightTheme.textPrimary,
  property: lightTheme.cyan,
  typeName: lightTheme.cyan,
  variable: lightTheme.textPrimary,
};

function buildHighlightStyle(p: SyntaxPalette) {
  return HighlightStyle.define([
    { tag: tags.heading1, color: p.heading, fontWeight: "bold" },
    { tag: tags.heading2, color: p.heading, fontWeight: "bold" },
    { tag: tags.heading3, color: p.heading, fontWeight: "bold" },
    { tag: tags.heading4, color: p.heading, fontWeight: "bold" },
    { tag: tags.heading5, color: p.heading, fontWeight: "bold" },
    { tag: tags.heading6, color: p.heading, fontWeight: "bold" },
    { tag: tags.strong, color: p.strong, fontWeight: "bold" },
    { tag: tags.emphasis, color: p.emphasis, fontStyle: "italic" },
    { tag: tags.strikethrough, textDecoration: "line-through", color: p.strikethrough },
    { tag: tags.link, color: p.link, textDecoration: "underline" },
    { tag: tags.url, color: p.link },
    {
      tag: tags.monospace,
      color: p.code,
      backgroundColor: p.codeBg,
      borderRadius: "4px",
      padding: "2px 8px",
    },
    { tag: tags.comment, color: p.comment },
    { tag: tags.meta, color: p.comment },
    { tag: tags.keyword, color: p.keyword },
    { tag: tags.string, color: p.string },
    { tag: tags.number, color: p.number },
    { tag: tags.bool, color: p.number },
    { tag: tags.operator, color: p.operator },
    { tag: tags.punctuation, color: p.operator },
    { tag: tags.bracket, color: p.bracket },
    { tag: tags.className, color: p.className },
    { tag: tags.function(tags.variableName), color: p.className },
    { tag: tags.definition(tags.variableName), color: p.definition },
    { tag: tags.propertyName, color: p.property },
    { tag: tags.typeName, color: p.typeName },
    { tag: tags.variableName, color: p.variable },
    { tag: tags.quote, color: p.comment, fontStyle: "italic" },
    { tag: tags.processingInstruction, color: p.comment },
  ]);
}

export const darkHighlightStyle = buildHighlightStyle(darkSyntax);
export const lightHighlightStyle = buildHighlightStyle(lightSyntax);

// Default export — dark theme + dark highlight (Editor.tsx swaps highlight via Compartment)
export const editorBaseTheme = editorTheme;
export const tokyoNight = [
  editorTheme,
  syntaxHighlighting(darkHighlightStyle),
];
