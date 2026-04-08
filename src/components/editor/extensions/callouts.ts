import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import type { Range } from "@codemirror/state";

// ---------------------------------------------------------------------------
// Callout type config
// ---------------------------------------------------------------------------

const CALLOUT_TYPES: Record<
  string,
  { className: string; icon: string; label: string }
> = {
  NOTE: {
    className: "cm-callout-note",
    label: "Note",
    // Lucide Info icon
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  },
  WARNING: {
    className: "cm-callout-warning",
    label: "Warning",
    // Lucide AlertTriangle
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  },
  TIP: {
    className: "cm-callout-tip",
    label: "Tip",
    // Lucide Lightbulb
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
  },
  IMPORTANT: {
    className: "cm-callout-important",
    label: "Important",
    // Lucide AlertCircle
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
  },
  CAUTION: {
    className: "cm-callout-caution",
    label: "Caution",
    // Lucide ShieldAlert
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
  },
};

// ---------------------------------------------------------------------------
// Detect callout header line: > [!TYPE] optional title
// ---------------------------------------------------------------------------

const CALLOUT_HEADER_RE = /^>\s*\[!(\w+)\]\s*(.*)$/;

// ---------------------------------------------------------------------------
// Build decorations
// ---------------------------------------------------------------------------

function buildCalloutDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const decorations: Range<Decoration>[] = [];

  let i = 1;
  while (i <= doc.lines) {
    const line = doc.line(i);
    const headerMatch = CALLOUT_HEADER_RE.exec(line.text);

    if (!headerMatch) {
      i++;
      continue;
    }

    const typeKey = headerMatch[1].toUpperCase();
    const config = CALLOUT_TYPES[typeKey];
    if (!config) {
      i++;
      continue;
    }

    // Decorate header line
    decorations.push(
      Decoration.line({
        class: `cm-callout ${config.className}`,
        attributes: {
          "data-callout-icon": config.icon,
          "data-callout-label": config.label,
        },
      }).range(line.from),
    );

    decorations.push(
      Decoration.line({ class: "cm-callout-header" }).range(line.from),
    );

    // Decorate continuation lines (lines starting with >)
    i++;
    while (i <= doc.lines) {
      const contLine = doc.line(i);
      if (/^>\s?/.test(contLine.text)) {
        decorations.push(
          Decoration.line({
            class: `cm-callout ${config.className}`,
          }).range(contLine.from),
        );
        i++;
      } else {
        break;
      }
    }
  }

  return Decoration.set(decorations);
}

// ---------------------------------------------------------------------------
// ViewPlugin
// ---------------------------------------------------------------------------

export const calloutExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildCalloutDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildCalloutDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
