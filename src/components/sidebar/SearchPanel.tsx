import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { useSearchStore } from "@/stores/searchStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { invoke } from "@tauri-apps/api/core";
import type { NoteData } from "@/lib/types";

export function SearchPanel() {
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const isSearching = useSearchStore((s) => s.isSearching);
  const setQuery = useSearchStore((s) => s.setQuery);
  const search = useSearchStore((s) => s.search);
  const clearResults = useSearchStore((s) => s.clearResults);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!value.trim()) {
        clearResults();
        return;
      }

      debounceRef.current = setTimeout(() => {
        search(value);
      }, 300);
    },
    [setQuery, search, clearResults],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search notes..."
          aria-label="Search vault"
          style={{
            height: 40,
            width: '100%',
            paddingLeft: 40,
            paddingRight: 12,
            fontSize: 13,
            borderRadius: 'var(--radius-xl)',
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'all 200ms',
          }}
        />
        {isSearching && (
          <Loader2
            size={14}
            className="animate-spin"
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
        )}
      </div>

      {/* Results area */}
      {!query.trim() ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 16 }}>
          Type to search across all notes.
        </p>
      ) : isSearching ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 16 }}>
          Searching...
        </p>
      ) : results.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 16 }}>
          No results found.
        </p>
      ) : (
        <div style={{ marginTop: 12 }}>
          <p
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              paddingLeft: 4,
              paddingBottom: 4,
              fontFamily: '"JetBrains Mono", "SF Mono", monospace',
            }}
          >
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
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(async () => {
    setActiveFile(result.path);

    try {
      const data = await invoke<NoteData>("read_note", { path: result.path });
      openTab(result.path, data.content);
    } catch {
      openTab(result.path, "");
    }
  }, [result.path, setActiveFile, openTab]);

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        width: '100%',
        padding: 12,
        borderRadius: 'var(--radius-md)',
        textAlign: 'left',
        cursor: 'pointer',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        background: hovered ? 'var(--muted-hover)' : 'transparent',
        transition: 'background 150ms',
      }}
    >
      {/* Title */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-primary)',
        }}
      >
        {result.title || result.path}
      </span>

      {/* Snippet */}
      <p
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
        dangerouslySetInnerHTML={{ __html: result.snippet }}
      />

      {/* Path */}
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: '"JetBrains Mono", "SF Mono", monospace',
        }}
      >
        {result.path}
      </span>
    </button>
  );
}
