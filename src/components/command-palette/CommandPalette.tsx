import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { Command as CommandIcon } from "lucide-react";
import { commandRegistry, type Command } from "@/lib/commandRegistry";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
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

interface FuzzyCommandResult {
  command: Command;
  score: number;
  indices: number[];
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results: FuzzyCommandResult[] = useMemo(() => {
    const allCommands = commandRegistry.getAll();

    if (!query.trim()) {
      const recent = commandRegistry.getRecent();
      const recentSet = new Set(recent.map((c) => c.id));
      const rest = allCommands.filter((c) => !recentSet.has(c.id));
      return [...recent, ...rest].map((c) => ({
        command: c,
        score: 0,
        indices: [],
      }));
    }

    return allCommands
      .map((cmd) => {
        const result = fuzzyMatch(query, cmd.label);
        if (!result.match) {
          const catResult = fuzzyMatch(query, cmd.category);
          if (catResult.match) {
            return {
              command: cmd,
              score: catResult.score * 0.5,
              indices: [],
            };
          }
          return null;
        }
        return { command: cmd, score: result.score, indices: result.indices };
      })
      .filter((r): r is FuzzyCommandResult => r !== null)
      .sort((a, b) => b.score - a.score);
  }, [query]);

  const groupedResults = useMemo(() => {
    const groups: { category: string; items: FuzzyCommandResult[] }[] = [];
    const categoryMap = new Map<string, FuzzyCommandResult[]>();

    for (const result of results) {
      const cat = result.command.category;
      if (!categoryMap.has(cat)) {
        const items: FuzzyCommandResult[] = [];
        categoryMap.set(cat, items);
        groups.push({ category: cat, items });
      }
      categoryMap.get(cat)!.push(result);
    }

    return groups;
  }, [results]);

  const flatResults = results;

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

  const executeCommand = useCallback(
    (cmd: Command) => {
      commandRegistry.execute(cmd.id);
      onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            executeCommand(flatResults[selectedIndex].command);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatResults, selectedIndex, executeCommand, onClose],
  );

  if (!isOpen) return null;

  let flatIndex = 0;

  const kbdStyle: React.CSSProperties = {
    marginLeft: 8,
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
          <CommandIcon size={16} style={{ color: 'var(--text-muted)', marginRight: 12 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
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
          {flatResults.length === 0 ? (
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
              No matching commands found.
            </div>
          ) : (
            groupedResults.map((group) => (
              <div key={group.category}>
                {/* Category header */}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    paddingLeft: 16,
                    paddingRight: 16,
                    paddingTop: 8,
                    paddingBottom: 4,
                    fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
                  }}
                >
                  {group.category}
                </div>

                {group.items.map((result) => {
                  const currentIdx = flatIndex++;
                  const isSelected = currentIdx === selectedIndex;
                  const isHovered = hoveredIndex === currentIdx;
                  return (
                    <div
                      key={result.command.id}
                      data-index={currentIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
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
                      onClick={() => executeCommand(result.command)}
                      onMouseEnter={() => {
                        setSelectedIndex(currentIdx);
                        setHoveredIndex(currentIdx);
                      }}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {highlightMatches(result.command.label, result.indices)}
                      </span>
                      {result.command.shortcut && (
                        <kbd style={kbdStyle}>
                          {result.command.shortcut}
                        </kbd>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
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
            <kbd style={kbdStyle}>Enter</kbd>{" "}execute
          </span>
          <span>
            <kbd style={kbdStyle}>Esc</kbd>{" "}close
          </span>
        </div>
      </div>
    </div>
  );
}
