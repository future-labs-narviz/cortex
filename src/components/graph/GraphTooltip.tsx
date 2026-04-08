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
      className="graph-tooltip fixed z-50 px-3 py-2 rounded-lg border max-w-[240px] shadow-xl"
      style={{
        left: x + 14,
        top: y + 14,
        background: "var(--bg-tertiary)",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="text-xs font-semibold truncate"
        style={{ color: "var(--text-primary)" }}
      >
        {node.label}
      </div>
      <div
        className="text-[10px] mt-0.5"
        style={{ color: "var(--text-muted)" }}
      >
        {connectionCount} connection{connectionCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
