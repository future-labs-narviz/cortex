import {
  ViewPlugin,
  type ViewUpdate,
  Decoration,
  type DecorationSet,
  EditorView,
} from "@codemirror/view";
import type { Range } from "@codemirror/state";

const frontmatterLine = Decoration.line({ class: "cm-frontmatter" });

function buildFrontmatterDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const ranges: Range<Decoration>[] = [];

  // Frontmatter must start at the very first line
  if (doc.lines < 1) return Decoration.none;

  const firstLine = doc.line(1);
  if (firstLine.text.trim() !== "---") return Decoration.none;

  // Find the closing ---
  let closingLine = -1;
  for (let i = 2; i <= doc.lines; i++) {
    const line = doc.line(i);
    if (line.text.trim() === "---") {
      closingLine = i;
      break;
    }
  }

  if (closingLine === -1) return Decoration.none;

  // Decorate all lines from 1 to closingLine
  for (let i = 1; i <= closingLine; i++) {
    const line = doc.line(i);
    ranges.push(frontmatterLine.range(line.from));
  }

  return Decoration.set(ranges);
}

export const frontmatterPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildFrontmatterDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildFrontmatterDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
