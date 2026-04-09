import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Play, Loader2, FileText, Target, Pencil, Save, X, Code } from "lucide-react";
import { useLayoutStore } from "@/stores/layoutStore";
import { useVaultStore } from "@/stores/vaultStore";
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

/**
 * Replace `key:` lines inside the YAML frontmatter block of a markdown
 * note. Mirrors the Rust `upsert_frontmatter_keys` helper used by
 * execute.rs for plan-status writeback. Plain string values only —
 * arrays/objects must still be edited via the raw markdown editor.
 */
function upsertFrontmatterKeys(raw: string, kvs: Array<[string, string]>): string {
  const trimmed = raw.replace(/^\uFEFF/, "");
  if (!trimmed.startsWith("---\n") && !trimmed.startsWith("---\r\n")) {
    // No frontmatter block — synthesize one.
    let block = "";
    for (const [k, v] of kvs) block += `${k}: ${v}\n`;
    return `---\n${block}---\n\n${raw}`;
  }
  const fmEnd = trimmed.indexOf("\n---", 4);
  if (fmEnd === -1) return raw;
  const fm = trimmed.slice(4, fmEnd);
  const body = trimmed.slice(fmEnd + 4);
  const handled = new Set<string>();
  const lines = fm.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    let wrote = false;
    for (const [k, v] of kvs) {
      if (handled.has(k)) continue;
      const re = new RegExp(`^\\s*${k}\\s*:`);
      if (re.test(line)) {
        out.push(`${k}: ${v}`);
        handled.add(k);
        wrote = true;
        break;
      }
    }
    if (!wrote) out.push(line);
  }
  for (const [k, v] of kvs) {
    if (!handled.has(k)) out.push(`${k}: ${v}`);
  }
  return `---\n${out.join("\n").replace(/\n+$/, "")}\n---${body}`;
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

interface EditDraft {
  title: string;
  goal: string;
  model: string;
  max_turns: string;
  max_budget_usd: string;
  permission_mode: string;
}

const PERMISSION_MODES = [
  "acceptEdits",
  "auto",
  "bypassPermissions",
  "default",
  "dontAsk",
  "plan",
] as const;

export function PlanRunnerView({ sheetId, planPath }: PlanRunnerViewProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const setSheetContent = useLayoutStore((s) => s.setSheetContent);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<NoteData>("read_note", { path: planPath });
      setContent(data.content);
    } catch (e) {
      setError(`Failed to load plan: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [planPath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const title = extractFrontmatterField(content, "title") ?? planPath;
  const goal = extractFrontmatterField(content, "goal") ?? "(no goal specified)";
  const status = extractFrontmatterField(content, "status") ?? "draft";
  const model = extractFrontmatterField(content, "model");
  const maxTurns = extractFrontmatterField(content, "max_turns");
  const maxBudget = extractFrontmatterField(content, "max_budget_usd");
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

  const handleStartEdit = useCallback(() => {
    setDraft({
      title: extractFrontmatterField(content, "title") ?? "",
      goal: extractFrontmatterField(content, "goal") ?? "",
      model: extractFrontmatterField(content, "model") ?? "",
      max_turns: extractFrontmatterField(content, "max_turns") ?? "",
      max_budget_usd: extractFrontmatterField(content, "max_budget_usd") ?? "",
      permission_mode:
        extractFrontmatterField(content, "permission_mode") ?? "acceptEdits",
    });
    setEditing(true);
  }, [content]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setDraft(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const kvs: Array<[string, string]> = [];
      if (draft.title.trim()) kvs.push(["title", draft.title.trim()]);
      if (draft.goal.trim()) kvs.push(["goal", draft.goal.trim()]);
      if (draft.model.trim()) kvs.push(["model", draft.model.trim()]);
      if (draft.max_turns.trim()) kvs.push(["max_turns", draft.max_turns.trim()]);
      if (draft.max_budget_usd.trim())
        kvs.push(["max_budget_usd", draft.max_budget_usd.trim()]);
      if (draft.permission_mode.trim())
        kvs.push(["permission_mode", draft.permission_mode.trim()]);
      const updated = upsertFrontmatterKeys(content, kvs);
      await invoke("write_note", { path: planPath, content: updated });
      setEditing(false);
      setDraft(null);
      await refresh();
    } catch (e) {
      setError(`Failed to save plan: ${e}`);
    } finally {
      setSaving(false);
    }
  }, [draft, content, planPath, refresh]);

  const handleOpenRaw = useCallback(() => {
    // Escape hatch: open the plan note in the regular markdown editor so
    // the user can edit array fields (allowed_tools, denied_tools,
    // context_entities, context_notes) that the simple form can't handle.
    useVaultStore.getState().setActiveFile(planPath);
    const layout = useLayoutStore.getState();
    layout.openFile(sheetId, planPath, content);
  }, [planPath, content, sheetId]);

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

      {/* Frontmatter summary or editor */}
      {editing && draft ? (
        <FrontmatterEditor
          draft={draft}
          onChange={setDraft}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
          saving={saving}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 8,
          }}
        >
          <Field label="Model" value={model ?? "default"} />
          <Field label="Max turns" value={maxTurns ?? "30"} />
          <Field label="Max budget" value={maxBudget ? `$${maxBudget}` : "$5"} />
          <Field label="Permissions" value={permissionMode} />
          <Field label="Path" value={planPath} mono />
        </div>
      )}

      {/* Execute / Edit / Open raw */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={handleExecute}
          disabled={executing || editing}
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

        {!editing && (
          <button
            onClick={handleStartEdit}
            disabled={executing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--muted)",
              color: "var(--text-secondary)",
              cursor: executing ? "default" : "pointer",
              transition: "all 150ms",
            }}
            onMouseEnter={(e) => {
              if (!executing) {
                e.currentTarget.style.background = "var(--muted-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--muted)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <Pencil size={13} /> Edit
          </button>
        )}

        {!editing && (
          <button
            onClick={handleOpenRaw}
            disabled={executing}
            title="Open in markdown editor for advanced fields (arrays, body)"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: executing ? "default" : "pointer",
              transition: "all 150ms",
            }}
            onMouseEnter={(e) => {
              if (!executing) {
                e.currentTarget.style.background = "var(--muted)";
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <Code size={13} /> Open raw
          </button>
        )}
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

function FrontmatterEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  draft: EditDraft;
  onChange: (d: EditDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        borderRadius: 10,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <FormField label="Title">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            style={inputStyle}
          />
        </FormField>
        <FormField label="Model">
          <input
            type="text"
            placeholder="claude-sonnet-4-5"
            value={draft.model}
            onChange={(e) => onChange({ ...draft, model: e.target.value })}
            style={inputStyle}
          />
        </FormField>
      </div>

      <FormField label="Goal (the prompt sent to claude)">
        <textarea
          value={draft.goal}
          onChange={(e) => onChange({ ...draft, goal: e.target.value })}
          rows={4}
          style={{
            ...inputStyle,
            fontFamily: '"JetBrains Mono", monospace',
            resize: "vertical",
            minHeight: 80,
          }}
        />
      </FormField>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
        }}
      >
        <FormField label="Max turns">
          <input
            type="number"
            min={1}
            placeholder="30"
            value={draft.max_turns}
            onChange={(e) => onChange({ ...draft, max_turns: e.target.value })}
            style={inputStyle}
          />
        </FormField>
        <FormField label="Max budget USD">
          <input
            type="number"
            step={0.5}
            min={0}
            placeholder="5"
            value={draft.max_budget_usd}
            onChange={(e) => onChange({ ...draft, max_budget_usd: e.target.value })}
            style={inputStyle}
          />
        </FormField>
        <FormField label="Permission mode">
          <select
            value={draft.permission_mode}
            onChange={(e) => onChange({ ...draft, permission_mode: e.target.value })}
            style={inputStyle}
          >
            {PERMISSION_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          fontStyle: "italic",
          padding: "8px 10px",
          borderRadius: 6,
          background: "var(--muted)",
        }}
      >
        Array fields (allowed_tools, denied_tools, context_entities,
        context_notes) and the note body can only be edited via "Open raw".
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: saving ? "default" : "pointer",
          }}
        >
          <X size={12} /> Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            border: "1px solid var(--accent-soft)",
            background: saving ? "var(--muted)" : "var(--accent-soft)",
            color: "var(--accent)",
            cursor: saving ? "default" : "pointer",
          }}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  outline: "none",
  width: "100%",
};

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
