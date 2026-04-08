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
      className="graph-tooltip"
      style={{
        position: 'fixed',
        zIndex: 50,
        left: x + 14,
        top: y + 14,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        maxWidth: 240,
        background: 'var(--bg-elevated)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {node.label}
      </div>
      <div
        style={{
          fontSize: 11,
          marginTop: 2,
          color: 'var(--text-muted)',
          fontFamily: '"JetBrains Mono", "SF Mono", monospace',
        }}
      >
        {connectionCount} connection{connectionCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
