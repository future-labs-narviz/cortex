import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { FileText } from "lucide-react";
import { useVaultStore, flattenFiles } from "@/stores/vaultStore";
import type { VaultFile } from "@/lib/types";

interface FuzzyResult {
  file: VaultFile;
  score: number;
  indices: number[];
}

function fuzzyMatch(
  query: string,
  target: string,
): { match: boolean; score: number; indices: number[] } {
  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const indices: number[] = [];

  let queryIdx = 0;
  let score = 0;
  let lastMatchIdx = -2;

  for (let i = 0; i < lowerTarget.length && queryIdx < lowerQuery.length; i++) {
    if (lowerTarget[i] === lowerQuery[queryIdx]) {
      indices.push(i);

      // Consecutive match bonus
      if (i === lastMatchIdx + 1) {
        score += 10;
      }

      // Word boundary bonus (start of string, after separator)
      if (i === 0 || /[\s\-_/.]/.test(target[i - 1])) {
        score += 8;
      }

      // Exact case match bonus
      if (target[i] === query[queryIdx]) {
        score += 2;
      }

      score += 1;
      lastMatchIdx = i;
      queryIdx++;
    }
  }

  const match = queryIdx === lowerQuery.length;

  // Penalize longer targets (prefer shorter, more relevant names)
  if (match) {
    score -= target.length * 0.5;
  }

  return { match, score, indices };
}

function highlightMatches(text: string, indices: number[]): React.ReactNode {
  if (indices.length === 0) return text;

  const indexSet = new Set(indices);
  const parts: React.ReactNode[] = [];
  let current = "";
  let isHighlighted = false;

  for (let i = 0; i < text.length; i++) {
    const shouldHighlight = indexSet.has(i);
    if (shouldHighlight !== isHighlighted) {
      if (current) {
        parts.push(
          isHighlighted ? (
            <span key={i} className="text-[var(--accent)] font-semibold">
              {current}
            </span>
          ) : (
            <span key={i}>{current}</span>
          ),
        );
      }
      current = "";
      isHighlighted = shouldHighlight;
    }
    current += text[i];
  }
  if (current) {
    parts.push(
      isHighlighted ? (
        <span key="last" className="text-[var(--accent)] font-semibold">
          {current}
        </span>
      ) : (
        <span key="last-plain">{current}</span>
      ),
    );
  }

  return <>{parts}</>;
}

interface QuickSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickSwitcher({ isOpen, onClose }: QuickSwitcherProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const files = useVaultStore((s) => s.files);
  const setActiveFile = useVaultStore((s) => s.setActiveFile);
  const allFiles = useMemo(() => flattenFiles(files), [files]);

  const results: FuzzyResult[] = useMemo(() => {
    if (!query.trim()) {
      return allFiles.map((f) => ({ file: f, score: 0, indices: [] }));
    }

    return allFiles
      .map((file) => {
        const result = fuzzyMatch(query, file.name);
        return { file, ...result };
      })
      .filter((r) => r.match)
      .sort((a, b) => b.score - a.score);
  }, [query, allFiles]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const openFile = useCallback(
    (file: VaultFile) => {
      setActiveFile(file.path);
      // Content will be loaded by AppShell's activeFilePath effect
      onClose();
    },
    [setActiveFile, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            openFile(results[selectedIndex].file);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, openFile, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        style={{ WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg mx-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-lg)] overflow-hidden transition-all duration-300 ease-in-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent */}
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent" />

        {/* Search input */}
        <div className="flex items-center px-4 border-b border-[var(--border)]">
          <FileText size={16} className="text-[var(--text-muted)] mr-2" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes..."
            className="flex-1 h-12 text-base bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          />
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          className="max-h-[300px] overflow-y-auto py-1"
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">
              No matching files found.
            </div>
          ) : (
            results.slice(0, 50).map((result, index) => {
              const relativePath = result.file.path;
              const dir = relativePath.includes("/")
                ? relativePath.replace(/\/[^/]+$/, "")
                : "";

              return (
                <div
                  key={result.file.path}
                  className={`flex items-center gap-2 px-4 py-3 cursor-pointer rounded-[var(--radius-lg)] transition-colors duration-150 mx-2 ${
                    index === selectedIndex
                      ? "bg-[var(--accent-soft)] border border-[var(--accent)]/20"
                      : "hover:bg-[var(--muted)]"
                  }`}
                  onClick={() => openFile(result.file)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <FileText
                    size={14}
                    className="flex-shrink-0 text-[var(--text-muted)]"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs text-[var(--text-primary)] truncate">
                      {highlightMatches(result.file.name, result.indices)}
                    </span>
                    {dir && (
                      <span className="text-[10px] text-[var(--text-muted)] truncate">
                        {dir}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)]">
          <span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--muted)] text-[var(--text-muted)] font-mono">
              &uarr;&darr;
            </kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--muted)] text-[var(--text-muted)] font-mono">
              Enter
            </kbd>{" "}
            open
          </span>
          <span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--muted)] text-[var(--text-muted)] font-mono">
              Esc
            </kbd>{" "}
            close
          </span>
        </div>
      </div>
    </div>
  );
}
