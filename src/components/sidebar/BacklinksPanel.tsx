import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "@/stores/vaultStore";
import { Link2 } from "lucide-react";

/** A backlink entry returned from the Rust backend. */
interface Backlink {
  source_path: string;
  source_title: string;
  context: string;
  line: number;
}

/**
 * BacklinksPanel shows all notes that link to the currently active note.
 *
 * Each backlink displays:
 *  - The source note title (clickable to navigate)
 *  - A context line with the wikilink highlighted
 */
export function BacklinksPanel() {
  const activeFilePath = useVaultStore((s) => s.activeFilePath);
  const setActiveFile = useVaultStore((s) => s.setActiveFile);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBacklinks = useCallback(async () => {
    if (!activeFilePath) {
      setBacklinks([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await invoke<Backlink[]>("get_backlinks", {
        notePath: activeFilePath,
      });
      setBacklinks(result);
    } catch (e) {
      console.warn("[Cortex] get_backlinks not available:", e);
      setError("Backlinks not available");
      setBacklinks([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilePath]);

  useEffect(() => {
    fetchBacklinks();
  }, [fetchBacklinks]);

  if (!activeFilePath) {
    return (
      <div className="flex flex-col items-center gap-4 pt-12 text-center">
        <Link2 size={24} className="text-[var(--text-muted)]" />
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Select a note to see
          <br />
          its backlinks.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 pt-12 text-center">
        <p className="text-xs text-[var(--text-muted)]">Loading backlinks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 pt-12 text-center">
        <Link2 size={24} className="text-[var(--text-muted)]" />
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          {error}
        </p>
      </div>
    );
  }

  if (backlinks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 pt-12 text-center">
        <Link2 size={24} className="text-[var(--text-muted)]" />
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          No backlinks found
          <br />
          for this note.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-2">
        <span>Backlinks</span>
        <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--muted)] text-[10px] text-[var(--text-muted)] font-medium">
          {backlinks.length}
        </span>
      </p>
      {backlinks.map((bl, idx) => (
        <button
          key={`${bl.source_path}-${bl.line}-${idx}`}
          onClick={() => setActiveFile(bl.source_path)}
          className="flex flex-col gap-1 w-full text-left px-3 py-2 rounded-[var(--radius-md)] hover:bg-[var(--muted)] transition-colors duration-150 cursor-pointer focus:outline-none"
        >
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {bl.source_title}
          </span>
          <span className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
            <HighlightedContext context={bl.context} />
          </span>
        </button>
      ))}
    </div>
  );
}

/** Highlights [[wikilinks]] in a context string. */
function HighlightedContext({ context }: { context: string }) {
  if (!context) return null;

  // Split on [[...]] to highlight wikilinks.
  const parts = context.split(/(\[\[[^\]]+\]\])/g);

  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("[[") && part.endsWith("]]") ? (
          <span
            key={i}
            className="text-[var(--accent)] font-medium"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
