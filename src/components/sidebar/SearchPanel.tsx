import { useCallback, useEffect, useRef } from "react";
import { Search, FileText, Loader2, FolderOpen } from "lucide-react";
import { useSearchStore } from "@/stores/searchStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { invoke } from "@tauri-apps/api/core";
import type { NoteData } from "@/lib/types";

export function SearchPanel() {
  const isVaultOpen = useVaultStore((s) => s.isVaultOpen);
  const openVault = useVaultStore((s) => s.openVault);
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const isSearching = useSearchStore((s) => s.isSearching);
  const setQuery = useSearchStore((s) => s.setQuery);
  const search = useSearchStore((s) => s.search);
  const clearResults = useSearchStore((s) => s.clearResults);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input on mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);

      // Clear previous debounce timer.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!value.trim()) {
        clearResults();
        return;
      }

      // Debounce search by 300ms.
      debounceRef.current = setTimeout(() => {
        search(value);
      }, 300);
    },
    [setQuery, search, clearResults],
  );

  // Clean up debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  if (!isVaultOpen) {
    return (
      <div className="flex flex-col items-center gap-3 pt-8 text-center">
        <FolderOpen size={32} className="text-[var(--text-muted)]" />
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          No vault open.
          <br />
          Open a vault to search notes.
        </p>
        <button
          onClick={() => openVault()}
          className="px-3 py-1.5 text-xs rounded-md bg-[var(--accent)] text-white hover:opacity-90 transition-opacity duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
        >
          Open Vault
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      {/* Search input */}
      <div className="relative">
        <Search
          size={13}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search notes..."
          className="w-full pl-7 pr-2.5 py-1.5 text-xs rounded-md bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border)] placeholder:text-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:border-[var(--accent)] transition-colors duration-150"
        />
        {isSearching && (
          <Loader2
            size={13}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] animate-spin"
          />
        )}
      </div>

      {/* Results area */}
      {!query.trim() ? (
        <p className="text-[11px] text-[var(--text-muted)] text-center pt-4">
          Type to search across all notes.
        </p>
      ) : isSearching ? (
        <p className="text-[11px] text-[var(--text-muted)] text-center pt-4">
          Searching...
        </p>
      ) : results.length === 0 ? (
        <p className="text-[11px] text-[var(--text-muted)] text-center pt-4">
          No results found.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] text-[var(--text-muted)] px-1 pb-1">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </p>
          {results.map((result) => (
            <SearchResultItem key={result.path} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}

interface SearchResultItemProps {
  result: {
    path: string;
    title: string;
    snippet: string;
    score: number;
  };
}

function SearchResultItem({ result }: SearchResultItemProps) {
  const setActiveFile = useVaultStore((s) => s.setActiveFile);
  const openTab = useEditorStore((s) => s.openTab);

  const handleClick = useCallback(async () => {
    setActiveFile(result.path);

    // Try to load the note content and open in editor.
    try {
      const data = await invoke<NoteData>("read_note", { path: result.path });
      openTab(result.path, data.content);
    } catch {
      // Backend may not be ready; just set active file.
      openTab(result.path, "");
    }
  }, [result.path, setActiveFile, openTab]);

  return (
    <button
      onClick={handleClick}
      className="flex flex-col gap-0.5 px-2 py-1.5 rounded-md text-left cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 group"
    >
      {/* Title */}
      <div className="flex items-center gap-1.5 min-w-0">
        <FileText
          size={12}
          className="flex-shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent)]"
        />
        <span className="text-xs font-medium text-[var(--text-primary)] truncate">
          {result.title || result.path}
        </span>
      </div>

      {/* Snippet */}
      <p
        className="text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed pl-[18px]"
        dangerouslySetInnerHTML={{ __html: result.snippet }}
      />

      {/* Path */}
      <span className="text-[10px] text-[var(--text-muted)] truncate pl-[18px]">
        {result.path}
      </span>
    </button>
  );
}
