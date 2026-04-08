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
// Widget – language label + copy button
// ---------------------------------------------------------------------------

class CodeBlockHeaderWidget extends WidgetType {
  constructor(
    private lang: string,
    private code: string,
  ) {
    super();
  }

  eq(other: CodeBlockHeaderWidget) {
    return this.lang === other.lang && this.code === other.code;
  }

  toDOM() {
    const header = document.createElement("div");
    header.className = "cm-code-header";

    if (this.lang) {
      const langLabel = document.createElement("span");
      langLabel.className = "cm-code-lang-label";
      langLabel.textContent = this.lang;
      header.appendChild(langLabel);
    }

    const copyBtn = document.createElement("button");
    copyBtn.className = "cm-code-copy-btn";
    copyBtn.textContent = "Copy";

    const code = this.code;
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(code);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    });

    header.appendChild(copyBtn);
    return header;
  }

  ignoreEvent() {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Build decorations
// ---------------------------------------------------------------------------

function buildCodeBlockDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const text = doc.toString();
  const decorations: Range<Decoration>[] = [];

  // Match fenced code blocks (but not mermaid, which is handled separately)
  const re = /^```(\w*)\s*\n([\s\S]*?)^```\s*$/gm;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const lang = m[1] || "";

    // Skip mermaid blocks (handled by mermaid extension)
    if (lang.toLowerCase() === "mermaid") continue;

    const code = m[2];
    const from = m.index;

    // Place the header widget at the start of the opening ``` line
    const line = doc.lineAt(from);

    decorations.push(
      Decoration.widget({
        widget: new CodeBlockHeaderWidget(lang, code),
        side: -1,
      }).range(line.from),
    );
  }

  return Decoration.set(decorations);
}

// ---------------------------------------------------------------------------
// ViewPlugin
// ---------------------------------------------------------------------------

export const codeBlockExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildCodeBlockDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildCodeBlockDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
