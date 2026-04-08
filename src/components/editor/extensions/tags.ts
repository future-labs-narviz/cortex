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
// Facet – available tag list
// ---------------------------------------------------------------------------

export const tagCompletions = Facet.define<string[], string[]>({
  combine: (values) => (values as string[][]).flat(),
});

// ---------------------------------------------------------------------------
// Decoration – highlight #tags
// ---------------------------------------------------------------------------

const tagMark = Decoration.mark({ class: "cm-tag" });

/**
 * Match #tags but avoid matching inside code spans / fenced blocks or URLs.
 * We require the character before # to be a whitespace, open-paren, or
 * start-of-line.  Uses a non-capturing leading group instead of lookbehind
 * for Safari 15 (macOS 12) compatibility.
 */
const tagMatcher = new MatchDecorator({
  regexp: /(?:^|[\s(])#([a-zA-Z0-9_\/-]+)/g,
  decoration: (_match, _view, pos) => {
    return tagMark;
  },
});

const tagHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = tagMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = tagMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

// ---------------------------------------------------------------------------
// Autocomplete – trigger on #
// ---------------------------------------------------------------------------

function tagCompletionSource(
  context: CompletionContext,
): CompletionResult | null {
  // Match # at start of line or after whitespace
  const match = context.matchBefore(/(?:^|[\s(])#([a-zA-Z0-9_\/-]*)$/);
  if (!match) return null;

  // Find the position of the # character
  const hashPos = match.text.lastIndexOf("#");
  const from = match.from + hashPos + 1; // after the #
  const query = match.text.slice(hashPos + 1).toLowerCase();

  const tags = context.state.facet(tagCompletions) as string[];
  if (tags.length === 0) return null;

  const filtered = tags
    .filter((tag) => tag.toLowerCase().includes(query))
    .sort((a, b) => {
      const al = a.toLowerCase();
      const bl = b.toLowerCase();
      const aStarts = al.startsWith(query) ? 0 : 1;
      const bStarts = bl.startsWith(query) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return al.localeCompare(bl);
    });

  return {
    from,
    options: filtered.map((tag) => ({
      label: tag,
    })),
    filter: false,
  };
}

const tagAutocomplete = autocompletion({
  override: [tagCompletionSource],
  activateOnTyping: true,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function tagExtension(config: { availableTags: string[] }): Extension[] {
  return [
    tagCompletions.of(config.availableTags),
    tagHighlighter,
    tagAutocomplete,
  ];
}
