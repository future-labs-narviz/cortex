import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Activity, Loader2, CheckCircle2, XCircle, Square, FileText } from "lucide-react";
import {
  useRunStore,
  type RunBlock,
  type RunMessage,
  type RunStatus,
} from "@/stores/runStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useLayoutStore } from "@/stores/layoutStore";
import type { NoteData } from "@/lib/types";

interface LiveSessionViewProps {
  runId: string;
  planPath: string;
}

/** Pull a `key: value` line out of a YAML frontmatter block. */
function fmField(content: string, key: string): string | null {
  const trimmed = content.replace(/^\uFEFF/, "");
  if (!trimmed.startsWith("---")) return null;
  const end = trimmed.indexOf("\n---", 3);
  if (end === -1) return null;
  const fm = trimmed.slice(3, end);
  const re = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const match = fm.match(re);
  return match ? match[1].trim() : null;
}

export function LiveSessionView({ runId, planPath }: LiveSessionViewProps) {
  const run = useRunStore((s) => s.runs[runId]);
  const initRun = useRunStore((s) => s.initRun);
  const applyEvent = useRunStore((s) => s.applyEvent);
  const markCompleted = useRunStore((s) => s.markCompleted);
  const markAborted = useRunStore((s) => s.markAborted);
  const markError = useRunStore((s) => s.markError);
  const replayFromEvents = useRunStore((s) => s.replayFromEvents);
  const [replayState, setReplayState] = useState<
    "idle" | "loading" | "loaded" | "no-transcript"
  >("idle");

  // Replay path: if there's no live state for this run, attempt to load
  // a persisted JSONL transcript and feed it through the runStore so the
  // user can scroll back through completed runs from the Sessions panel.
  useEffect(() => {
    if (run) return; // already in store (live or replayed)
    if (replayState !== "idle") return;
    setReplayState("loading");
    (async () => {
      try {
        const lines = await invoke<string[]>("load_run_transcript", { runId });
        if (lines.length === 0) {
          // No persisted JSONL — could be a Phase A session or an
          // in-flight/never-started run. Initialize empty state and
          // bail out of replay; live subscription effect below will
          // still attach in case events arrive.
          initRun(runId, planPath);
          setReplayState("no-transcript");
          return;
        }
        // Read session note frontmatter for status + cost metadata.
        let finalStatus: RunStatus = "complete";
        const meta: {
          totalCostUsd?: number;
          durationMs?: number;
          numTurns?: number;
          retrospectivePath?: string;
        } = {};
        try {
          const noteData = await invoke<NoteData>("read_note", {
            path: `sessions/${runId}.md`,
          });
          const status = fmField(noteData.content, "status");
          if (status === "complete" || status === "failed" || status === "aborted") {
            finalStatus = status;
          }
          const cost = fmField(noteData.content, "total_cost_usd");
          if (cost) meta.totalCostUsd = parseFloat(cost);
          const dur = fmField(noteData.content, "duration_ms");
          if (dur) meta.durationMs = parseInt(dur, 10);
          const turns = fmField(noteData.content, "num_turns");
          if (turns) meta.numTurns = parseInt(turns, 10);
        } catch {
          // No session note (or unreadable) — fall through with defaults.
        }
        const retroCandidate = `sessions/${runId}-retrospective.md`;
        try {
          await invoke<NoteData>("read_note", { path: retroCandidate });
          meta.retrospectivePath = retroCandidate;
        } catch {
          // No retrospective — leave undefined.
        }
        replayFromEvents(runId, planPath, lines, finalStatus, meta);
        setReplayState("loaded");
      } catch (err) {
        console.warn("[Cortex] load_run_transcript failed", err);
        initRun(runId, planPath);
        setReplayState("no-transcript");
      }
    })();
  }, [runId, planPath, run, replayState, initRun, replayFromEvents]);

  useEffect(() => {
    if (!useRunStore.getState().runs[runId]) {
      initRun(runId, planPath);
    }

    // StrictMode-safe async subscribe: track cancellation so the cleanup
    // function tears down listeners that resolve AFTER the effect was
    // already torn down. Without this, dev mode registers each listener
    // twice and every stream event is applied twice.
    let cancelled = false;
    const unlistens: Array<() => void> = [];

    const register = async (
      event: string,
      handler: (payload: unknown) => void
    ) => {
      try {
        const unlisten = await listen<unknown>(event, (e) => handler(e.payload));
        if (cancelled) {
          unlisten();
          return;
        }
        unlistens.push(unlisten);
      } catch (err) {
        console.warn(`[Cortex] failed to subscribe to ${event}`, err);
      }
    };

    register(`cortex://session/event/${runId}`, (payload) =>
      applyEvent(runId, payload)
    );
    register("cortex://session/completed", (payload) => {
      const p = payload as {
        run_id: string;
        total_cost_usd: number;
        duration_ms: number;
        num_turns: number;
        is_error?: boolean;
        retrospective_path?: string | null;
      };
      if (p.run_id === runId) markCompleted(runId, p);
    });
    register("cortex://session/aborted", (payload) => {
      const p = payload as { run_id: string; partial_event_count: number };
      if (p.run_id === runId) markAborted(runId, p.partial_event_count);
    });
    register("cortex://session/error", (payload) => {
      const p = payload as { run_id: string; message: string };
      if (p.run_id === runId) markError(runId, p.message);
    });

    return () => {
      cancelled = true;
      unlistens.forEach((u) => u());
    };
  }, [runId, planPath]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAbort = () => {
    invoke("abort_run", { runId }).catch((err) =>
      console.warn("[Cortex] abort_run failed", err)
    );
  };

  const handleOpenRetrospective = () => {
    if (!run?.retrospectivePath) return;
    const path = run.retrospectivePath;
    useVaultStore.getState().setActiveFile(path);
    const layout = useLayoutStore.getState();
    invoke<NoteData>("read_note", { path })
      .then((data) => layout.openFile(layout.activeSheetId, path, data.content))
      .catch(() => layout.openFile(layout.activeSheetId, path, ""));
  };

  const messages = run?.messages ?? [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        background: "var(--bg-primary)",
      }}
    >
      <SessionHeader
        runId={runId}
        planPath={planPath}
        status={run?.status ?? "starting"}
        eventCount={run?.eventCount ?? 0}
        totalCostUsd={run?.totalCostUsd ?? 0}
        durationMs={run?.durationMs}
        numTurns={run?.numTurns}
        retrospectivePath={run?.retrospectivePath}
        onAbort={handleAbort}
        onOpenRetrospective={handleOpenRetrospective}
      />

      {run?.rateLimitWarning && (
        <div
          style={{
            padding: "8px 16px",
            background: "rgba(245, 158, 11, 0.08)",
            color: "#f59e0b",
            fontSize: 12,
            borderBottom: "1px solid var(--border)",
          }}
        >
          {run.rateLimitWarning}
        </div>
      )}

      {run?.errorMessage && (
        <div
          style={{
            padding: "8px 16px",
            background: "rgba(239, 68, 68, 0.08)",
            color: "#ef4444",
            fontSize: 12,
            borderBottom: "1px solid var(--border)",
          }}
        >
          {run.errorMessage}
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 24px 80px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {messages.length === 0 && run?.status === "starting" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "48px 0",
              color: "var(--text-muted)",
              gap: 12,
            }}
          >
            <Loader2 size={20} className="animate-spin" />
            <span style={{ fontSize: 12 }}>Spawning claude…</span>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────

function SessionHeader(props: {
  runId: string;
  planPath: string;
  status: RunStatus;
  eventCount: number;
  totalCostUsd: number;
  durationMs?: number;
  numTurns?: number;
  retrospectivePath?: string;
  onAbort: () => void;
  onOpenRetrospective: () => void;
}) {
  const statusInfo = useMemo(() => {
    switch (props.status) {
      case "starting":
        return { label: "Starting", color: "var(--text-muted)", Icon: Loader2, spin: true };
      case "running":
        return { label: "Running", color: "var(--accent)", Icon: Activity, spin: false };
      case "complete":
        return { label: "Complete", color: "#22c55e", Icon: CheckCircle2, spin: false };
      case "failed":
        return { label: "Failed", color: "#ef4444", Icon: XCircle, spin: false };
      case "aborted":
        return { label: "Aborted", color: "#f59e0b", Icon: XCircle, spin: false };
    }
  }, [props.status]);

  const Icon = statusInfo.Icon;
  const isLive = props.status === "starting" || props.status === "running";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "12px 24px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-secondary)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Icon
          size={16}
          className={statusInfo.spin ? "animate-spin" : undefined}
          style={{ color: statusInfo.color }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: statusInfo.color,
          }}
        >
          {statusInfo.label}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          {props.planPath}
        </span>
        <div style={{ flex: 1 }} />
        {isLive && (
          <button
            onClick={props.onAbort}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              fontSize: 11,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--muted)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 150ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.1)";
              e.currentTarget.style.color = "#ef4444";
              e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--muted)";
              e.currentTarget.style.color = "var(--text-secondary)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            <Square size={11} /> Abort
          </button>
        )}
        {props.retrospectivePath && (
          <button
            onClick={props.onOpenRetrospective}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              fontSize: 11,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--muted)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <FileText size={11} /> Retrospective
          </button>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 16,
          fontSize: 11,
          color: "var(--text-muted)",
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        <span>events {props.eventCount}</span>
        {typeof props.numTurns === "number" && <span>turns {props.numTurns}</span>}
        {typeof props.durationMs === "number" && (
          <span>{(props.durationMs / 1000).toFixed(1)}s</span>
        )}
        {props.totalCostUsd > 0 && (
          <span title="Estimated equivalent cost — Max plan covers actual billing">
            ~${props.totalCostUsd.toFixed(3)} eq.
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Message bubble + blocks ─────────────────────────────────────────────

function MessageBubble({ message }: { message: RunMessage }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        borderRadius: 10,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {message.role} {message.done ? "" : "·"}
      </div>
      {message.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: RunBlock }) {
  if (block.type === "text") {
    return (
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--text-primary)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {block.text || <span style={{ color: "var(--text-muted)" }}>…</span>}
      </div>
    );
  }
  if (block.type === "thinking") {
    return (
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.6,
          color: "var(--text-muted)",
          fontStyle: "italic",
          padding: "8px 10px",
          borderLeft: "2px solid var(--border)",
          whiteSpace: "pre-wrap",
        }}
      >
        {block.text || "thinking…"}
      </div>
    );
  }
  if (block.type === "tool_use") {
    const summary = block.inputObj
      ? (() => {
          const obj = block.inputObj as Record<string, unknown>;
          if (typeof obj.file_path === "string") return obj.file_path;
          if (typeof obj.command === "string") return obj.command;
          return JSON.stringify(obj).slice(0, 120);
        })()
      : block.inputJson || "…";
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "8px 10px",
          borderRadius: 6,
          background: "var(--muted)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--accent)",
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          {block.toolName}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            fontFamily: '"JetBrains Mono", monospace',
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {summary}
        </div>
      </div>
    );
  }
  return null;
}
