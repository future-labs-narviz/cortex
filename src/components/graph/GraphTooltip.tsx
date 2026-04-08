import type { GraphNode } from "@/lib/types";

interface GraphTooltipProps {
  node: GraphNode | null;
  connectionCount: number;
  x: number;
  y: number;
  visible: boolean;
}

export function GraphTooltip({
  node,
  connectionCount,
  x,
  y,
  visible,
}: GraphTooltipProps) {
  if (!visible || !node) return null;

  return (
    <div
      className="graph-tooltip fixed z-50 px-3 py-2 border border-[var(--border)] rounded-[var(--radius-xl)] max-w-[240px]"
      style={{
        left: x + 14,
        top: y + 14,
        background: "var(--bg-elevated)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div className="text-sm font-semibold truncate text-[var(--text-primary)]">
        {node.label}
      </div>
      <div className="text-xs mt-0.5 text-[var(--text-muted)]">
        {connectionCount} connection{connectionCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
