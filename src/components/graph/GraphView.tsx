import { useEffect, useRef, useState, useCallback } from "react";
import { useGraphStore } from "@/stores/graphStore";
import { useVaultStore } from "@/stores/vaultStore";
import { GraphCanvas } from "./GraphCanvas";
import { GraphControls } from "./GraphControls";
import { GraphTooltip } from "./GraphTooltip";
import { Loader2, AlertTriangle, Network } from "lucide-react";
import type { GraphNode } from "@/lib/types";

interface GraphViewProps {
  /** When true, renders in compact sidebar mode */
  compact?: boolean;
}

export function GraphView({ compact = false }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [tooltipNode, setTooltipNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const activeFilePath = useVaultStore((s) => s.activeFilePath);
  const setActiveFile = useVaultStore((s) => s.setActiveFile);

  const data = useGraphStore((s) => s.data);
  const mode = useGraphStore((s) => s.mode);
  const depth = useGraphStore((s) => s.depth);
  const showOrphans = useGraphStore((s) => s.showOrphans);
  const isLoading = useGraphStore((s) => s.isLoading);
  const error = useGraphStore((s) => s.error);
  const fetchGraphData = useGraphStore((s) => s.fetchGraphData);

  // -----------------------------------------------------------------------
  // Resize observer
  // -----------------------------------------------------------------------

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // -----------------------------------------------------------------------
  // Fetch data when mode / depth / active note changes
  // -----------------------------------------------------------------------

  useEffect(() => {
    fetchGraphData(activeFilePath ?? undefined);
  }, [mode, depth, activeFilePath, fetchGraphData]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setActiveFile(nodeId);
    },
    [setActiveFile],
  );

  const handleNodeHover = useCallback(
    (node: GraphNode | null, x: number, y: number) => {
      setTooltipNode(node);
      setTooltipPos({ x, y });
      setTooltipVisible(node !== null);
    },
    [],
  );

  const handleFitView = useCallback(() => {
    const svg = containerRef.current?.querySelector("svg") as unknown as
      | Record<string, () => void>
      | undefined;
    if (svg?.__fitView) svg.__fitView();
  }, []);

  const handleCenterActive = useCallback(() => {
    if (!activeFilePath) return;
    const svg = containerRef.current?.querySelector("svg") as unknown as
      | Record<string, (id: string) => void>
      | undefined;
    if (svg?.__centerOnNode) svg.__centerOnNode(activeFilePath);
  }, [activeFilePath]);

  // -----------------------------------------------------------------------
  // Derived values
  // -----------------------------------------------------------------------

  const nodeCount = data?.nodes.length ?? 0;
  const edgeCount = data?.edges.length ?? 0;

  const connectionCount = tooltipNode
    ? (data?.edges.filter(
        (e) => e.source === tooltipNode.id || e.target === tooltipNode.id,
      ).length ?? 0)
    : 0;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div
      ref={containerRef}
      className="graph-container flex-1 w-full h-full relative"
      style={{
        minHeight: compact ? 200 : undefined,
      }}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-2">
          <Loader2
            size={24}
            className="animate-spin"
            style={{ color: "var(--text-muted)" }}
          />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Loading graph...
          </p>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-3">
          <AlertTriangle size={24} style={{ color: "var(--yellow)" }} />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {error}
          </p>
          <button
            onClick={() => fetchGraphData(activeFilePath ?? undefined)}
            className="px-3 py-1.5 text-xs rounded-md transition-all duration-150 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
            style={{
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && data && data.nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-2">
          <Network size={24} style={{ color: "var(--text-muted)" }} />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No notes to display.
          </p>
        </div>
      )}

      {/* Canvas */}
      {data && dimensions.width > 0 && dimensions.height > 0 && (
        <GraphCanvas
          data={data}
          width={dimensions.width}
          height={dimensions.height}
          activeNodeId={activeFilePath ?? undefined}
          showOrphans={showOrphans}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
        />
      )}

      {/* Controls */}
      {!compact && (
        <GraphControls
          nodeCount={nodeCount}
          edgeCount={edgeCount}
          onFitView={handleFitView}
          onCenterActive={handleCenterActive}
        />
      )}

      {/* Tooltip */}
      <GraphTooltip
        node={tooltipNode}
        connectionCount={connectionCount}
        x={tooltipPos.x}
        y={tooltipPos.y}
        visible={tooltipVisible}
      />
    </div>
  );
}
