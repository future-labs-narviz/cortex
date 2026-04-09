import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Play, RefreshCw, FileText } from "lucide-react";
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

  const openPlan = useCallback((path: string) => {
    const layout = useLayoutStore.getState();
    layout.setSheetContent(layout.activeSheetId, { kind: "plan-runner", planPath: path });
  }, []);

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
