import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Play, RefreshCw, FileText, Plus, Sparkles, Loader2, X } from "lucide-react";
import { useLayoutStore } from "@/stores/layoutStore";

interface PlanSummary {
  path: string;
  title: string;
  goal: string | null;
  status: string;
  model: string | null;
  last_run_id: string | null;
  last_run_at: string | null;
}

export function PlansPanel() {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string>("");
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [showNewPlanInput, setShowNewPlanInput] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [showDraftInput, setShowDraftInput] = useState(false);
  const [draftGoal, setDraftGoal] = useState("");

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<PlanSummary[]>("list_plan_notes");
      setPlans(result);
    } catch (e) {
      console.warn("[Cortex] list_plan_notes error:", e);
      setError("Failed to load plans.");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Auto-refresh on Phase B run lifecycle so the status pill on each
  // plan card reflects reality without a manual refresh click.
  useEffect(() => {
    let cancelled = false;
    const unlistens: Array<() => void> = [];
    const subscribe = async (event: string) => {
      try {
        const u = await listen(event, () => {
          if (!cancelled) fetchPlans();
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
  }, [fetchPlans]);

  const openPlan = useCallback((path: string) => {
    const layout = useLayoutStore.getState();
    layout.setSheetContent(layout.activeSheetId, { kind: "plan-runner", planPath: path });
  }, []);

  const handleNewPlan = useCallback(() => {
    setShowNewPlanInput(true);
    setNewPlanTitle("");
  }, []);

  const submitNewPlan = useCallback(async () => {
    if (!newPlanTitle.trim()) return;
    setShowNewPlanInput(false);
    try {
      const path = await invoke<string>("create_plan_note", { title: newPlanTitle.trim() });
      await fetchPlans();
      const layout = useLayoutStore.getState();
      layout.setSheetContent(layout.activeSheetId, { kind: "plan-runner", planPath: path });
    } catch (e) {
      console.warn("[Cortex] create_plan_note failed", e);
      setError(`Failed to create plan: ${e}`);
    }
    setNewPlanTitle("");
  }, [newPlanTitle, fetchPlans]);

  // Subscribe to draft lifecycle events while a draft is in flight so the
  // user gets a tiny status string AND a cancel button wired to the
  // draft_id. Only listens while drafting=true to keep the channel quiet
  // otherwise.
  useEffect(() => {
    if (!drafting) return;
    let cancelled = false;
    const unlistens: Array<() => void> = [];
    const subscribe = async (event: string, handler: (p: unknown) => void) => {
      try {
        const u = await listen<unknown>(event, (e) => handler(e.payload));
        if (cancelled) {
          u();
          return;
        }
        unlistens.push(u);
      } catch (err) {
        console.warn(`[Cortex] failed to subscribe to ${event}`, err);
      }
    };
    subscribe("cortex://draft/started", (p) => {
      const payload = p as { draft_id?: string };
      if (payload.draft_id) setCurrentDraftId(payload.draft_id);
      setDraftStatus("exploring vault…");
    });
    subscribe("cortex://draft/aborted", (p) => {
      const payload = p as { draft_id?: string };
      // Only clear state if this is OUR draft (guards against stale events).
      setCurrentDraftId((prev) => {
        if (prev && payload.draft_id && prev !== payload.draft_id) return prev;
        return null;
      });
      setDrafting(false);
      setDraftStatus("");
      setError("Draft cancelled.");
    });
    return () => {
      cancelled = true;
      unlistens.forEach((u) => u());
    };
  }, [drafting]);

  const handleDraftPlan = useCallback(() => {
    setShowDraftInput(true);
    setDraftGoal("");
  }, []);

  const submitDraftPlan = useCallback(async () => {
    if (!draftGoal.trim()) return;
    setShowDraftInput(false);
    setDrafting(true);
    setDraftStatus("spawning plan-mode claude…");
    setError(null);
    try {
      const path = await invoke<string>("draft_plan_from_goal", { goal: draftGoal.trim() });
      await fetchPlans();
      const layout = useLayoutStore.getState();
      layout.setSheetContent(layout.activeSheetId, { kind: "plan-runner", planPath: path });
    } catch (e) {
      const msg = String(e);
      // "draft aborted by user" is the expected error when abort_draft
      // terminates the spawn — not an error worth surfacing loudly.
      if (!msg.includes("aborted by user")) {
        console.warn("[Cortex] draft_plan_from_goal failed", e);
        setError(`Draft failed: ${msg}`);
      }
    } finally {
      setDrafting(false);
      setDraftStatus("");
      setCurrentDraftId(null);
    }
    setDraftGoal("");
  }, [draftGoal, fetchPlans]);

  const handleAbortDraft = useCallback(async () => {
    if (!currentDraftId) return;
    try {
      await invoke("abort_draft", { draftId: currentDraftId });
    } catch (e) {
      console.warn("[Cortex] abort_draft failed", e);
    }
  }, [currentDraftId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
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
          {plans.length} plan{plans.length !== 1 ? "s" : ""}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={handleDraftPlan}
            disabled={drafting}
            title="Draft a plan from a one-sentence goal (spawns claude in plan mode)"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: drafting ? "var(--accent)" : "var(--text-muted)",
              cursor: drafting ? "default" : "pointer",
              transition: "all 150ms",
              opacity: drafting ? 0.85 : 1,
            }}
            onMouseEnter={(e) => {
              if (!drafting) {
                e.currentTarget.style.background = "var(--muted-hover)";
                e.currentTarget.style.color = "var(--accent)";
              }
            }}
            onMouseLeave={(e) => {
              if (!drafting) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-muted)";
              }
            }}
          >
            {drafting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
          </button>
          <button
            onClick={handleNewPlan}
            title="New plan from template"
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
              cursor: "pointer",
              transition: "all 150ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--muted-hover)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <Plus size={14} />
          </button>
          <button
            onClick={fetchPlans}
            disabled={loading}
            title="Refresh plans"
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
            <RefreshCw
              size={14}
              style={{ animation: loading ? "spin 1s linear infinite" : "none" }}
            />
          </button>
        </div>
      </div>

      {drafting && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-soft)",
            color: "var(--accent)",
            fontSize: 11,
          }}
        >
          <Loader2 size={12} className="animate-spin" />
          <span style={{ flex: 1 }}>
            Drafting plan {draftStatus ? `— ${draftStatus}` : "…"}
          </span>
          {currentDraftId && (
            <button
              onClick={handleAbortDraft}
              title="Cancel drafting"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                padding: "2px 6px",
                fontSize: 10,
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                cursor: "pointer",
                transition: "all 150ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                e.currentTarget.style.color = "#ef4444";
                e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              <X size={10} /> Cancel
            </button>
          )}
        </div>
      )}

      {showNewPlanInput && (
        <div style={{ display: "flex", gap: 4, padding: "0 2px" }}>
          <input
            autoFocus
            placeholder="Plan title…"
            value={newPlanTitle}
            onChange={(e) => setNewPlanTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewPlan();
              if (e.key === "Escape") { setShowNewPlanInput(false); setNewPlanTitle(""); }
            }}
            style={{
              flex: 1,
              fontSize: 12,
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <button
            onClick={submitNewPlan}
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--accent)",
              background: "var(--accent)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Create
          </button>
        </div>
      )}

      {showDraftInput && (
        <div style={{ display: "flex", gap: 4, padding: "0 2px" }}>
          <input
            autoFocus
            placeholder="Describe your goal…"
            value={draftGoal}
            onChange={(e) => setDraftGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitDraftPlan();
              if (e.key === "Escape") { setShowDraftInput(false); setDraftGoal(""); }
            }}
            style={{
              flex: 1,
              fontSize: 12,
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <button
            onClick={submitDraftPlan}
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--accent)",
              background: "var(--accent)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Draft
          </button>
        </div>
      )}

      {loading && plans.length === 0 && (
        <PlansEmptyState message="Loading plans..." />
      )}
      {error && <PlansEmptyState message={error} />}
      {!loading && !error && plans.length === 0 && (
        <PlansEmptyState message="No plan notes yet. Create a markdown file with `type: plan` frontmatter to get started." />
      )}

      {plans.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {plans.map((plan) => (
            <PlanCard key={plan.path} plan={plan} onOpen={openPlan} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  onOpen,
}: {
  plan: PlanSummary;
  onOpen: (path: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const statusColor = (() => {
    switch (plan.status) {
      case "running":
        return "var(--accent)";
      case "ready":
        return "#a855f7";
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
      onClick={() => onOpen(plan.path)}
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
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Play
          size={12}
          style={{
            flexShrink: 0,
            color: hovered ? "var(--accent)" : statusColor,
            transition: "color 150ms",
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {plan.title}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "2px 6px",
            borderRadius: 4,
            background: "var(--bg-primary)",
            color: statusColor,
            border: `1px solid ${statusColor}`,
            flexShrink: 0,
          }}
        >
          {plan.status}
        </span>
      </div>

      {plan.goal && (
        <p
          style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            margin: 0,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            paddingLeft: 18,
          }}
        >
          {plan.goal}
        </p>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          paddingLeft: 18,
        }}
      >
        <FileText size={9} style={{ color: "var(--text-muted)" }} />
        <span
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            fontFamily: '"JetBrains Mono", monospace',
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {plan.path}
        </span>
      </div>
    </button>
  );
}

function PlansEmptyState({ message }: { message: string }) {
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
        <Play style={{ width: 16, height: 16, color: "var(--text-muted)" }} />
      </div>
      <p
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          lineHeight: 1.6,
          maxWidth: 220,
        }}
      >
        {message}
      </p>
    </div>
  );
}
