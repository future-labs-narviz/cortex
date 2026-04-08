import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  highlightActiveLine,
  lineNumbers,
  drawSelection,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLineGutter,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { searchKeymap, search } from "@codemirror/search";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";

import { markdownExtension } from "./extensions/markdown";
import { frontmatterPlugin } from "./extensions/frontmatter";
import { wikilinkExtension } from "./extensions/wikilinks";
import { tagExtension } from "./extensions/tags";
import { mathExtension } from "./extensions/math";
import { mermaidExtension } from "./extensions/mermaid";
import { calloutExtension } from "./extensions/callouts";
import { imageExtension } from "./extensions/images";
import { codeBlockExtension } from "./extensions/codeblocks";
import { tokyoNight } from "./themes/base";
import { setEditorView, setCurrentNoteId } from "@/lib/editorApi";
import { useVaultStore } from "@/stores/vaultStore";
import { findNoteByName } from "@/lib/utils/noteResolver";

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  filePath?: string;
}

export function Editor({ content, onChange, onSave, filePath }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const isExternalUpdate = useRef(false);

  // Keep refs up-to-date
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  // Create / destroy EditorView on mount / unmount (and on tab switch)
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        // Custom keybindings first (higher priority)
        keymap.of([
          {
            key: "Mod-s",
            run: () => {
              onSaveRef.current?.();
              return true;
            },
          },
        ]),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),

        // Core features
        history(),
        search(),
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        rectangularSelection(),
        crosshairCursor(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),

        // Markdown
        markdownExtension(),

        // Frontmatter
        frontmatterPlugin,

        // Rich content extensions
        mathExtension,
        mermaidExtension,
        calloutExtension,
        imageExtension,
        codeBlockExtension,

        // Wikilinks & Tags
        ...wikilinkExtension({
          onNavigate: (target) => {
            const files = useVaultStore.getState().files;
            const match = findNoteByName(files, target);
            if (match) {
              useVaultStore.getState().setActiveFile(match.path);
            }
          },
          noteNames: useVaultStore
            .getState()
            .files.filter((f) => !f.is_dir)
            .map((f) => f.name.replace(/\.md$/, "")),
        }),
        ...tagExtension({
          availableTags: [], // Will be populated later from the graph indexer
        }),

        // Theme
        ...tokyoNight,

        // Change listener
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isExternalUpdate.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),

        // Make it fill its container
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": {
            overflow: "auto",
            fontFamily:
              '"JetBrains Mono", "SF Mono", "Fira Code", "Cascadia Code", monospace',
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    setEditorView(view);
    setCurrentNoteId(filePath ?? null);

    return () => {
      view.destroy();
      viewRef.current = null;
      setEditorView(null);
      setCurrentNoteId(null);
    };
    // Only run on mount/unmount and when filePath changes (tab switch).
    // content is intentionally excluded -- we sync it separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  // Sync external content changes without cursor jump
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (content !== currentContent) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content,
        },
      });
      isExternalUpdate.current = false;
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-hidden bg-[var(--bg-primary)]"
      data-testid="editor-container"
    />
  );
}
