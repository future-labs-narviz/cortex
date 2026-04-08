import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { Range } from "@codemirror/state";
import mermaid from "mermaid";

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
});

let mermaidIdCounter = 0;

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

class MermaidWidget extends WidgetType {
  constructor(private source: string) {
    super();
  }

  eq(other: MermaidWidget) {
    return this.source === other.source;
  }

  toDOM() {
    const container = document.createElement("div");
    container.className = "cm-mermaid-container";

    const id = `mermaid-${++mermaidIdCounter}`;

    mermaid
      .render(id, this.source)
      .then(({ svg }) => {
        container.innerHTML = svg;

        // Add copy SVG button
        const btn = document.createElement("button");
        btn.className = "cm-code-copy-btn";
        btn.textContent = "Copy SVG";
        btn.style.cssText =
          "position:absolute;top:10px;right:10px;font-size:11px;padding:2px 8px;border-radius:4px;background:var(--bg-secondary);color:var(--text-muted);border:none;cursor:pointer;font-family:'JetBrains Mono','SF Mono',monospace;transition:opacity 150ms;opacity:0.7;";
        btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; btn.style.color = "var(--text-primary)"; });
        btn.addEventListener("mouseleave", () => { btn.style.opacity = "0.7"; btn.style.color = "var(--text-muted)"; });
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(svg);
          btn.textContent = "Copied!";
          btn.style.color = "var(--green)";
          setTimeout(() => { btn.textContent = "Copy SVG"; btn.style.color = "var(--text-muted)"; }, 2000);
        });
        container.style.position = "relative";
        container.appendChild(btn);
      })
      .catch(() => {
        container.textContent = "Failed to render diagram";
        container.classList.add("cm-math-error");
      });

    return container;
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

function buildMermaidDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const text = doc.toString();
  const decorations: Range<Decoration>[] = [];

  const re = /```mermaid\s*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const from = m.index;
    const to = from + m[0].length;
    if (cursorInsideRange(view, from, to)) continue;

    const source = m[1].trim();
    if (!source) continue;

    decorations.push(
      Decoration.replace({
        widget: new MermaidWidget(source),
      }).range(from, to),
    );
  }

  return Decoration.set(decorations);
}

// ---------------------------------------------------------------------------
// ViewPlugin
// ---------------------------------------------------------------------------

export const mermaidExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildMermaidDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged
      ) {
        this.decorations = buildMermaidDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
