import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { Range } from "@codemirror/state";
import katex from "katex";

// ---------------------------------------------------------------------------
// Widget – renders LaTeX via KaTeX
// ---------------------------------------------------------------------------

class MathWidget extends WidgetType {
  constructor(
    private math: string,
    private block: boolean,
  ) {
    super();
  }

  eq(other: MathWidget) {
    return this.math === other.math && this.block === other.block;
  }

  toDOM() {
    const el = document.createElement(this.block ? "div" : "span");
    el.className = this.block ? "cm-math-block" : "cm-math-inline";
    try {
      katex.render(this.math, el, {
        displayMode: this.block,
        throwOnError: false,
      });
    } catch {
      el.textContent = this.math;
      el.className += " cm-math-error";
    }
    return el;
  }

  ignoreEvent() {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cursorInsideRange(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  for (const range of view.state.selection.ranges) {
    if (range.from <= to && range.to >= from) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Build decorations
// ---------------------------------------------------------------------------

function buildMathDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const text = doc.toString();
  const decorations: Range<Decoration>[] = [];

  // Block math: $$ on own lines
  const blockRe = /^\$\$\s*\n([\s\S]*?)\n\s*\$\$\s*$/gm;
  let m: RegExpExecArray | null;

  while ((m = blockRe.exec(text)) !== null) {
    const from = m.index;
    const to = from + m[0].length;
    if (cursorInsideRange(view, from, to)) continue;

    const math = m[1].trim();
    if (!math) continue;

    decorations.push(
      Decoration.replace({
        widget: new MathWidget(math, true),
      }).range(from, to),
    );
  }

  // Inline math: $...$ (not $$)
  const inlineRe = /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g;

  while ((m = inlineRe.exec(text)) !== null) {
    const from = m.index;
    const to = from + m[0].length;

    // Skip if overlapping with a block math region
    if (cursorInsideRange(view, from, to)) continue;

    const math = m[1].trim();
    if (!math) continue;

    decorations.push(
      Decoration.replace({
        widget: new MathWidget(math, false),
      }).range(from, to),
    );
  }

  // Sort by from position (required by CodeMirror)
  decorations.sort((a, b) => a.from - b.from);

  return Decoration.set(decorations);
}

// ---------------------------------------------------------------------------
// ViewPlugin
// ---------------------------------------------------------------------------

export const mathExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildMathDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged
      ) {
        this.decorations = buildMathDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
