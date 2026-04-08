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
      if (i === lastMatchIdx + 1) score += 10;
      if (i === 0 || /[\s\-_/.]/.test(target[i - 1])) score += 8;
      if (target[i] === query[queryIdx]) score += 2;
      score += 1;
      lastMatchIdx = i;
      queryIdx++;
    }
  }

  const match = queryIdx === lowerQuery.length;
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
            <span key={i} style={{ color: 'var(--accent)', fontWeight: 600 }}>
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
        <span key="last" style={{ color: 'var(--accent)', fontWeight: 600 }}>
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
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

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelector(
      `[data-index="${selectedIndex}"]`,
    ) as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const openFile = useCallback(
    (file: VaultFile) => {
      setActiveFile(file.path);
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

  const kbdStyle: React.CSSProperties = {
    marginLeft: 4,
    flexShrink: 0,
    fontSize: 11,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 2,
    paddingBottom: 2,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
    fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        animation: 'modalIn 200ms ease-out',
      }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          WebkitBackdropFilter: 'blur(8px)',
          backdropFilter: 'blur(8px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 512,
          marginLeft: 16,
          marginRight: 16,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div
          style={{
            height: 1,
            background: 'linear-gradient(to right, transparent, rgba(59, 130, 246, 0.4), transparent)',
          }}
        />

        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 16,
            paddingRight: 16,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <FileText size={16} style={{ color: 'var(--text-muted)', marginRight: 12, flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes..."
            style={{
              flex: 1,
              height: 48,
              fontSize: 16,
              background: 'transparent',
              color: 'var(--text-primary)',
              border: 'none',
              outline: 'none',
            }}
          />
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          {results.length === 0 ? (
            <div
              style={{
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 24,
                paddingBottom: 24,
                textAlign: 'center',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              No matching files found.
            </div>
          ) : (
            results.slice(0, 50).map((result, index) => {
              const relativePath = result.file.path;
              const dir = relativePath.includes("/")
                ? relativePath.replace(/\/[^/]+$/, "")
                : "";
              const isSelected = index === selectedIndex;
              const isHovered = hoveredIndex === index;

              return (
                <div
                  key={result.file.path}
                  data-index={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    paddingLeft: 16,
                    paddingRight: 16,
                    paddingTop: 10,
                    paddingBottom: 10,
                    marginLeft: 8,
                    marginRight: 8,
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-lg)',
                    transition: 'background 150ms',
                    background: isSelected
                      ? 'var(--accent-soft)'
                      : isHovered
                        ? 'var(--muted-hover)'
                        : 'transparent',
                    border: isSelected
                      ? '1px solid rgba(59, 130, 246, 0.2)'
                      : '1px solid transparent',
                  }}
                  onClick={() => openFile(result.file)}
                  onMouseEnter={() => {
                    setSelectedIndex(index);
                    setHoveredIndex(index);
                  }}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <FileText
                    size={14}
                    style={{ flexShrink: 0, color: 'var(--text-muted)' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {highlightMatches(result.file.name, result.indices)}
                    </span>
                    {dir && (
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 8,
            paddingBottom: 8,
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          <span>
            <kbd style={kbdStyle}>&uarr;&darr;</kbd>{" "}navigate
          </span>
          <span>
            <kbd style={kbdStyle}>Enter</kbd>{" "}open
          </span>
          <span>
            <kbd style={kbdStyle}>Esc</kbd>{" "}close
          </span>
        </div>
      </div>
    </div>
  );
}
