import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Play, Loader2, FileText, Target } from "lucide-react";
import { useLayoutStore } from "@/stores/layoutStore";
import type { NoteData } from "@/lib/types";

interface PlanRunnerViewProps {
  sheetId: string;
  planPath: string;
}

interface ExecuteRunResponse {
  run_id: string;
  session_note_path: string;
  plan_path: string;
}

function extractFrontmatterField(content: string, key: string): string | null {
  const fm = extractYamlBlock(content);
  if (!fm) return null;
  const re = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const match = fm.match(re);
  if (!match) return null;
  return match[1].trim().replace(/^["'](.*)["']$/, "$1");
}

function extractYamlBlock(content: string): string | null {
  const trimmed = content.replace(/^\uFEFF/, "");
  if (!trimmed.startsWith("---")) return null;
  const end = trimmed.indexOf("\n---", 3);
  if (end === -1) return null;
  return trimmed.slice(3, end);
}

function extractBody(content: string): string {
  const trimmed = content.replace(/^\uFEFF/, "");
  if (!trimmed.startsWith("---")) return content;
  const end = trimmed.indexOf("\n---", 3);
  if (end === -1) return content;
  return trimmed.slice(end + 4).trimStart();
}

export function PlanRunnerView({ sheetId, planPath }: PlanRunnerViewProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSheetContent = useLayoutStore((s) => s.setSheetContent);

  useEffect(() => {
    setLoading(true);
    setError(null);
    invoke<NoteData>("read_note", { path: planPath })
      .then((data) => {
        setContent(data.content);
      })
      .catch((e) => {
        setError(`Failed to load plan: ${e}`);
      })
      .finally(() => setLoading(false));
  }, [planPath]);

  const title = extractFrontmatterField(content, "title") ?? planPath;
  const goal = extractFrontmatterField(content, "goal") ?? "(no goal specified)";
  const status = extractFrontmatterField(content, "status") ?? "draft";
  const model = extractFrontmatterField(content, "model");
  const maxTurns = extractFrontmatterField(content, "max_turns");
  const permissionMode = extractFrontmatterField(content, "permission_mode") ?? "acceptEdits";
  const body = extractBody(content);

  const handleExecute = useCallback(async () => {
    setExecuting(true);
    setError(null);
    try {
      const resp = await invoke<ExecuteRunResponse>("execute_plan", { planPath });
      setSheetContent(sheetId, {
        kind: "session",
        runId: resp.run_id,
        planPath: resp.plan_path,
      });
    } catch (e) {
      setError(`Failed to start run: ${e}`);
      setExecuting(false);
    }
  }, [planPath, sheetId, setSheetContent]);

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
        }}
      >
        Loading plan…
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px 32px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          <FileText size={12} />
          Plan
          <StatusPill status={status} />
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h1>
      </div>

      {/* Goal block */}
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: 16,
          borderRadius: 10,
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <Target size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--text-primary)",
            whiteSpace: "pre-wrap",
          }}
        >
          {goal}
        </div>
      </div>

      {/* Frontmatter summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 8,
        }}
      >
        <Field label="Model" value={model ?? "default"} />
        <Field label="Max turns" value={maxTurns ?? "30"} />
        <Field label="Permissions" value={permissionMode} />
        <Field label="Path" value={planPath} mono />
      </div>

      {/* Execute */}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={handleExecute}
          disabled={executing}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: "1px solid var(--accent-soft)",
            background: executing ? "var(--muted)" : "var(--accent-soft)",
            color: "var(--accent)",
            cursor: executing ? "default" : "pointer",
            transition: "all 150ms",
          }}
          onMouseEnter={(e) => {
            if (!executing) {
              e.currentTarget.style.background = "var(--accent)";
              e.currentTarget.style.color = "white";
            }
          }}
          onMouseLeave={(e) => {
            if (!executing) {
              e.currentTarget.style.background = "var(--accent-soft)";
              e.currentTarget.style.color = "var(--accent)";
            }
          }}
        >
          {executing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {executing ? "Starting…" : "Execute"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "rgba(239, 68, 68, 0.08)",
            color: "#ef4444",
            fontSize: 12,
            border: "1px solid rgba(239, 68, 68, 0.3)",
          }}
        >
          {error}
        </div>
      )}

      {/* Body preview */}
      {body && (
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            whiteSpace: "pre-wrap",
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          {body}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 12px",
        borderRadius: 8,
        background: "var(--muted)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          color: "var(--text-primary)",
          fontFamily: mono ? '"JetBrains Mono", monospace' : undefined,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "running"
      ? "var(--accent)"
      : status === "complete"
        ? "#22c55e"
        : status === "failed"
          ? "#ef4444"
          : status === "ready"
            ? "#a855f7"
            : "var(--text-muted)";
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "2px 6px",
        borderRadius: 4,
        background: "var(--muted)",
        color,
        border: `1px solid ${color}`,
      }}
    >
      {status}
    </span>
  );
}
