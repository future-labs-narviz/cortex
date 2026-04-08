import {
  Decoration,
  DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { Facet, Extension } from "@codemirror/state";
import {
  autocompletion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";

// ---------------------------------------------------------------------------
// Facets – allow the host to supply callbacks & data
// ---------------------------------------------------------------------------

/** Callback invoked when a user clicks a wikilink. */
export const wikilinkNavigate = Facet.define<
  (target: string) => void,
  (target: string) => void
>({
  combine: (values) => values[0] ?? (() => {}),
});

/** List of note names shown in the autocomplete dropdown. */
export const wikilinkCompletions = Facet.define<string[], string[]>({
  combine: (values) => (values as string[][]).flat(),
});

// ---------------------------------------------------------------------------
// Decoration – highlight [[wikilinks]] in the document
// ---------------------------------------------------------------------------

const wikilinkMark = Decoration.mark({ class: "cm-wikilink" });

const wikilinkMatcher = new MatchDecorator({
  regexp: /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g,
  decoration: () => wikilinkMark,
});

const wikilinkHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = wikilinkMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = wikilinkMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

// ---------------------------------------------------------------------------
// Click handler – navigate on click
// ---------------------------------------------------------------------------

const wikilinkClickHandler = EditorView.domEventHandlers({
  click(event: MouseEvent, view: EditorView) {
    const target = event.target as HTMLElement;
    if (!target.closest(".cm-wikilink")) return false;

    // Resolve position in the document
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    // Walk outward from the click position to find the full [[…]] match
    const line = view.state.doc.lineAt(pos);
    const lineText = line.text;
    const re = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;
    let m: RegExpExecArray | null;

    while ((m = re.exec(lineText)) !== null) {
      const from = line.from + m.index;
      const to = from + m[0].length;
      if (pos >= from && pos <= to) {
        const noteName = m[1];
        const navigate = view.state.facet(wikilinkNavigate) as (target: string) => void;
        navigate(noteName);
        event.preventDefault();
        return true;
      }
    }

    return false;
  },
});

// ---------------------------------------------------------------------------
// Autocomplete – trigger on [[
// ---------------------------------------------------------------------------

function wikilinkCompletionSource(
  context: CompletionContext,
): CompletionResult | null {
  const match = context.matchBefore(/\[\[([^\]]*)$/);
  if (!match) return null;

  // The typed query is everything after the [[
  const query = match.text.slice(2).toLowerCase();
  const names = context.state.facet(wikilinkCompletions) as string[];

  const filtered = names
    .filter((name) => name.toLowerCase().includes(query))
    .sort((a, b) => {
      const al = a.toLowerCase();
      const bl = b.toLowerCase();
      // Prefer starts-with matches
      const aStarts = al.startsWith(query) ? 0 : 1;
      const bStarts = bl.startsWith(query) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return al.localeCompare(bl);
    });

  return {
    from: match.from + 2, // after [[
    options: filtered.map((name) => ({
      label: name,
      apply: `${name}]]`,
    })),
    filter: false,
  };
}

const wikilinkAutocomplete = autocompletion({
  override: [wikilinkCompletionSource],
  activateOnTyping: true,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function wikilinkExtension(config: {
  onNavigate: (target: string) => void;
  noteNames: string[];
}): Extension[] {
  return [
    wikilinkNavigate.of(config.onNavigate),
    wikilinkCompletions.of(config.noteNames),
    wikilinkHighlighter,
    wikilinkClickHandler,
    wikilinkAutocomplete,
  ];
}
