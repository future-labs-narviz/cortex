import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { Range } from "@codemirror/state";

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

class ImageWidget extends WidgetType {
  constructor(
    private src: string,
    private alt: string,
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return this.src === other.src && this.alt === other.alt;
  }

  toDOM() {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-image-widget";

    // Placeholder while loading
    const placeholder = document.createElement("div");
    placeholder.className = "cm-image-placeholder";
    placeholder.textContent = "Loading image...";
    wrapper.appendChild(placeholder);

    const img = document.createElement("img");
    img.alt = this.alt;
    img.title = this.alt;

    // Resolve source: support file://, http(s)://, and relative paths via asset protocol
    let resolvedSrc = this.src;
    if (
      !resolvedSrc.startsWith("http://") &&
      !resolvedSrc.startsWith("https://") &&
      !resolvedSrc.startsWith("file://") &&
      !resolvedSrc.startsWith("asset://") &&
      !resolvedSrc.startsWith("data:")
    ) {
      // Use Tauri asset protocol for local files
      resolvedSrc = `asset://localhost/${encodeURI(resolvedSrc)}`;
    }
    img.src = resolvedSrc;

    img.onload = () => {
      placeholder.remove();
      wrapper.appendChild(img);
    };

    img.onerror = () => {
      placeholder.textContent = `Image not found: ${this.src}`;
    };

    // Click to open full-size modal
    img.addEventListener("click", () => {
      const modal = document.createElement("div");
      modal.style.cssText =
        "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;cursor:pointer;";
      const fullImg = document.createElement("img");
      fullImg.src = img.src;
      fullImg.style.cssText = "max-width:90vw;max-height:90vh;border-radius:8px;";
      modal.appendChild(fullImg);
      modal.addEventListener("click", () => modal.remove());
      document.body.appendChild(modal);
    });

    return wrapper;
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

function buildImageDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const text = doc.toString();
  const decorations: Range<Decoration>[] = [];

  // Standard markdown: ![alt](path)
  const mdRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;

  while ((m = mdRe.exec(text)) !== null) {
    const from = m.index;
    const to = from + m[0].length;
    if (cursorInsideRange(view, from, to)) continue;

    decorations.push(
      Decoration.replace({
        widget: new ImageWidget(m[2], m[1]),
      }).range(from, to),
    );
  }

  // Obsidian embed: ![[image.png]]
  const obsRe = /!\[\[([^\]]+\.(png|jpg|jpeg|gif|svg|webp|bmp))\]\]/gi;

  while ((m = obsRe.exec(text)) !== null) {
    const from = m.index;
    const to = from + m[0].length;
    if (cursorInsideRange(view, from, to)) continue;

    decorations.push(
      Decoration.replace({
        widget: new ImageWidget(m[1], m[1]),
      }).range(from, to),
    );
  }

  decorations.sort((a, b) => a.from - b.from);

  return Decoration.set(decorations);
}

// ---------------------------------------------------------------------------
// ViewPlugin
// ---------------------------------------------------------------------------

export const imageExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildImageDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged
      ) {
        this.decorations = buildImageDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
