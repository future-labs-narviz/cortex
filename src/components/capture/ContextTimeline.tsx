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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          Development Timeline
        </span>
        <button
          onClick={() => fetchSessions()}
          disabled={isLoading}
          style={{ display: 'flex', alignItems: 'center', padding: 6, borderRadius: 'var(--radius-sm)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: isLoading ? 0.5 : 1 }}
          title="Refresh"
        >
          <RefreshCw style={{ width: 14, height: 14 }} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--red)', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-lg)', padding: '10px 12px', marginBottom: 12 }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => fetchSessions()}
            style={{ fontSize: 11, fontWeight: 500, padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && sessions.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center' }}>
          <RefreshCw style={{ width: 18, height: 18, color: 'var(--text-muted)', marginBottom: 12 }} className="animate-spin" />
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading sessions...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sessions.length === 0 && insights.length === 0 && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', padding: '0 24px' }}>
          <Calendar style={{ width: 20, height: 20, color: 'var(--text-muted)', marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 6 }}>
            No captured sessions yet.
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Configure Claude Code hooks to automatically capture context.
          </p>
        </div>
      )}

      {/* Timeline */}
      {grouped.length > 0 && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
          {grouped.map((group) => (
            <div key={group.date}>
              {/* Date header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {group.label}
                </span>
                <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
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
