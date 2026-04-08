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

interface FuzzyCommandResult {
  command: Command;
  score: number;
  indices: number[];
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results: FuzzyCommandResult[] = useMemo(() => {
    const allCommands = commandRegistry.getAll();

    if (!query.trim()) {
      // Show recent first, then the rest
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
        // Also match against category
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

  // Group results by category
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

  // Flat list for keyboard navigation
  const flatResults = results;

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

  // Build a flat index counter for matching selectedIndex to grouped items
  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center px-3 border-b border-[var(--border)]">
          <CommandIcon size={14} className="text-[var(--text-muted)] mr-2" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 py-3 text-sm bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          />
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-1">
          {flatResults.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">
              No matching commands found.
            </div>
          ) : (
            groupedResults.map((group) => (
              <div key={group.category}>
                {/* Category header */}
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {group.category}
                </div>

                {group.items.map((result) => {
                  const currentIdx = flatIndex++;
                  return (
                    <div
                      key={result.command.id}
                      data-index={currentIdx}
                      className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors duration-75 ${
                        currentIdx === selectedIndex
                          ? "bg-[var(--accent-soft)]"
                          : "hover:bg-[var(--bg-tertiary)]"
                      }`}
                      onClick={() => executeCommand(result.command)}
                      onMouseEnter={() => setSelectedIndex(currentIdx)}
                    >
                      <span className="text-xs text-[var(--text-primary)] truncate">
                        {highlightMatches(result.command.label, result.indices)}
                      </span>
                      {result.command.shortcut && (
                        <kbd className="ml-4 shrink-0 px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[10px] font-mono text-[var(--text-muted)]">
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
        <div className="flex items-center gap-3 px-3 py-2 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)]">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] font-mono">
              &uarr;&darr;
            </kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] font-mono">
              Enter
            </kbd>{" "}
            execute
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] font-mono">
              Esc
            </kbd>{" "}
            close
          </span>
        </div>
      </div>
    </div>
  );
}
