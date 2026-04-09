import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useVaultStore } from "@/stores/vaultStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { Activity, RefreshCw, Clock, Play } from "lucide-react";
import type { NoteData } from "@/lib/types";

interface SessionSummary {
  session_id: string;
  path: string;
  started_at: string | null;
  ended_at: string | null;
  goal: string | null;
  note_type: string;
  plan_ref: string | null;
  transcript_path: string | null;
  status: string;
}

/** Format an ISO timestamp into relative human-readable text. */
function relativeTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return "just now";
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export function SessionsPanel() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<SessionSummary[]>("list_session_notes");
      setSessions(result);
    } catch (e) {
      console.warn("[Cortex] list_session_notes error:", e);
      setError("Failed to load sessions.");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-refresh whenever a Phase B run starts, completes, or aborts.
  // The backend emits these events from execute.rs::run_event_loop.
  useEffect(() => {
    let cancelled = false;
    const unlistens: Array<() => void> = [];
    const subscribe = async (event: string) => {
      try {
        const u = await listen(event, () => {
          if (!cancelled) fetchSessions();
        });
        if (cancelled) {
          u();
          return;
        }
        unlistens.push(u);
      } catch (err) {
        console.warn(`[Cortex] failed to subscribe to ${event}`, err);
      }
    };
    subscribe("cortex://session/started");
    subscribe("cortex://session/completed");
    subscribe("cortex://session/aborted");
    return () => {
      cancelled = true;
      unlistens.forEach((u) => u());
    };
  }, [fetchSessions]);

  const openSession = useCallback((session: SessionSummary) => {
    const layout = useLayoutStore.getState();
    const sheetId = layout.activeSheetId;
    // Phase B sessions (those with a plan_ref) → live transcript replay
    // sheet, which loads the JSONL via load_run_transcript and feeds it
    // through the runStore reducer.
    if (session.plan_ref && session.note_type === "session") {
      layout.setSheetContent(sheetId, {
        kind: "session",
        runId: session.session_id,
        planPath: session.plan_ref,
      });
      return;
    }
    // Phase A sessions and retrospective notes → regular file editor.
    useVaultStore.getState().setActiveFile(session.path);
    invoke<NoteData>("read_note", { path: session.path })
      .then((data) => layout.openFile(sheetId, session.path, data.content))
      .catch(() => layout.openFile(sheetId, session.path, ""));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: '"JetBrains Mono", "SF Mono", monospace',
          }}
        >
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={fetchSessions}
          disabled={loading}
          title="Refresh sessions"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 6,
            border: "none",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: loading ? "default" : "pointer",
            transition: "all 150ms",
            opacity: loading ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = "var(--muted-hover)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* State views */}
      {loading && sessions.length === 0 && (
        <SessionsEmptyState message="Loading sessions..." />
      )}

      {error && (
        <SessionsEmptyState message={error} />
      )}

      {!loading && !error && sessions.length === 0 && (
        <SessionsEmptyState message="No sessions captured yet. Start a Claude Code session in this vault to capture one." />
      )}

      {/* Session list */}
      {sessions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {sessions.map((session) => (
            <SessionCard
              key={session.path}
              session={session}
              onOpen={openSession}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session,
  onOpen,
}: {
  session: SessionSummary;
  onOpen: (s: SessionSummary) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const isRetro = session.note_type === "retrospective";
  const isPhaseB = session.plan_ref !== null && session.note_type === "session";

  const statusColor = (() => {
    switch (session.status) {
      case "running":
        return "var(--accent)";
      case "complete":
        return "#22c55e";
      case "failed":
        return "#ef4444";
      case "aborted":
        return "#f59e0b";
      default:
        return "var(--text-muted)";
    }
  })();

  return (
    <button
      onClick={() => onOpen(session)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
        textAlign: "left",
        padding: 10,
        borderRadius: 8,
        background: hovered ? "var(--muted-hover)" : "var(--muted)",
        border: "1px solid var(--border)",
        transition: "all 150ms",
        cursor: "pointer",
      }}
    >
      {/* Top row: icon + time + badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {isPhaseB ? (
          <Play
            size={14}
            style={{
              flexShrink: 0,
              color: hovered ? "var(--accent)" : statusColor,
              transition: "color 150ms",
            }}
          />
        ) : (
          <Activity
            size={14}
            style={{
              flexShrink: 0,
              color: hovered ? "var(--accent)" : "var(--text-muted)",
              transition: "color 150ms",
            }}
          />
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
          {session.started_at && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                fontSize: 11,
                color: "var(--text-muted)",
                fontFamily: '"JetBrains Mono", "SF Mono", monospace',
                flexShrink: 0,
              }}
            >
              <Clock size={10} />
              {relativeTime(session.started_at)}
            </span>
          )}
        </div>
        {/* Type badge */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            padding: "2px 6px",
            borderRadius: 4,
            background: isRetro
              ? "rgba(168,85,247,0.12)"
              : isPhaseB
                ? "rgba(34,197,94,0.12)"
                : "rgba(59,130,246,0.12)",
            color: isRetro ? "#a855f7" : isPhaseB ? "#22c55e" : "var(--accent)",
            flexShrink: 0,
          }}
          title={isPhaseB ? `Phase B: ${session.status}` : undefined}
        >
          {isRetro ? "retro" : isPhaseB ? `B·${session.status || "?"}` : "session"}
        </span>
      </div>

      {/* Goal text */}
      {session.goal && (
        <p
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            margin: 0,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            paddingLeft: 20,
          }}
        >
          {session.goal}
        </p>
      )}

      {/* Path */}
      <span
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          fontFamily: '"JetBrains Mono", "SF Mono", monospace',
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          paddingLeft: 20,
        }}
      >
        {session.path}
      </span>
    </button>
  );
}

function SessionsEmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 180,
        textAlign: "center",
        paddingLeft: 24,
        paddingRight: 24,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--radius-xl)",
          background: "var(--muted)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Activity style={{ width: 18, height: 18, color: "var(--text-muted)" }} />
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 200 }}>
        {message}
      </p>
    </div>
  );
}
