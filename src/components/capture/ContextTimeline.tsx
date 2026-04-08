import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Calendar, AlertTriangle } from "lucide-react";
import { useCaptureStore, initCaptureListeners } from "@/stores/captureStore";
import { SessionCard } from "./SessionCard";
import { InsightCard } from "./InsightCard";
import type { CapturedSession, CapturedInsight } from "@/lib/types";

type TimelineEntry =
  | { kind: "session"; data: CapturedSession; sortKey: string }
  | { kind: "insight"; data: CapturedInsight; sortKey: string };

function dateLabel(iso: string): string {
  try {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Unknown date";
  }
}

function dateKey(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "0000-00-00";
  }
}

const PAGE_SIZE = 20;

export function ContextTimeline() {
  const { sessions, insights, isLoading, error, fetchSessions } = useCaptureStore();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    initCaptureListeners();
    fetchSessions();
  }, [fetchSessions]);

  // Merge sessions and insights into a single sorted timeline.
  const entries = useMemo(() => {
    const items: TimelineEntry[] = [];

    for (const session of sessions) {
      const key = session.started_at ?? session.ended_at ?? "";
      items.push({ kind: "session", data: session, sortKey: key });
    }

    for (const insight of insights) {
      items.push({ kind: "insight", data: insight, sortKey: insight.created_at });
    }

    // Sort newest first.
    items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    return items;
  }, [sessions, insights]);

  // Group by date.
  const grouped = useMemo(() => {
    const visible = entries.slice(0, visibleCount);
    const groups: { date: string; label: string; items: TimelineEntry[] }[] = [];
    let currentDate = "";

    for (const entry of visible) {
      const dk = dateKey(entry.sortKey);
      if (dk !== currentDate) {
        currentDate = dk;
        groups.push({
          date: dk,
          label: dateLabel(entry.sortKey),
          items: [],
        });
      }
      groups[groups.length - 1].items.push(entry);
    }

    return groups;
  }, [entries, visibleCount]);

  const hasMore = visibleCount < entries.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
        <h3 className="text-xs font-semibold text-[var(--text-primary)]">
          Development Timeline
        </h3>
        <button
          onClick={() => fetchSessions()}
          disabled={isLoading}
          className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:bg-[var(--muted)] p-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
          title="Refresh sessions"
        >
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 text-[11px] text-[var(--red)] bg-[var(--red)]/10 rounded-[var(--radius-lg)] px-3 py-2.5 mb-2">
          <AlertTriangle size={14} className="flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => fetchSessions()}
            className="text-[10px] font-medium px-2 py-1 rounded-[var(--radius-sm)] hover:bg-[var(--red)]/20 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && sessions.length === 0 && (
        <div className="flex flex-col items-center gap-2 pt-8 text-center">
          <RefreshCw size={20} className="text-[var(--text-muted)] animate-spin" />
          <p className="text-xs text-[var(--text-muted)]">Loading sessions...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sessions.length === 0 && insights.length === 0 && !error && (
        <div className="flex flex-col items-center gap-3 pt-8 text-center">
          <Calendar size={32} className="text-[var(--text-muted)]" />
          <div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              No captured sessions yet.
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-relaxed">
              Configure Claude Code hooks to
              <br />
              automatically capture your dev context.
            </p>
          </div>
        </div>
      )}

      {/* Timeline */}
      {grouped.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {grouped.map((group) => (
            <div key={group.date}>
              {/* Date header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-[10px] font-medium text-[var(--text-muted)] whitespace-nowrap">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>

              {/* Entries */}
              <div>
                {group.items.map((entry) => {
                  if (entry.kind === "session") {
                    return (
                      <SessionCard
                        key={entry.data.session_id}
                        session={entry.data}
                      />
                    );
                  }
                  return (
                    <InsightCard
                      key={entry.data.id}
                      insight={entry.data}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load more button */}
          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="w-full text-center text-[11px] text-[var(--accent)] hover:underline py-2 cursor-pointer rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
            >
              Load more ({entries.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
