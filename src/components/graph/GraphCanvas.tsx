import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { GraphData, GraphNode } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types for D3 simulation
// ---------------------------------------------------------------------------

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  weight: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GraphCanvasProps {
  data: GraphData;
  width: number;
  height: number;
  activeNodeId?: string;
  showOrphans: boolean;
  onNodeClick: (nodeId: string) => void;
  onNodeHover?: (node: GraphNode | null, x: number, y: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLOR_PALETTE = [
  "#7aa2f7",
  "#bb9af7",
  "#9ece6a",
  "#ff9e64",
  "#73daca",
  "#f7768e",
  "#e0af68",
];

const ACTIVE_COLOR = "#ff9e64";
const EDGE_COLOR = "#3b4261";
const BG_COLOR = "#1a1b26";
const LABEL_COLOR = "#a9b1d6";
const MAX_LABEL_LEN = 20;
const LARGE_GRAPH_THRESHOLD = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function folderFromId(id: string): string {
  const parts = id.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}

function nodeColor(node: SimNode, activeId?: string): string {
  if (activeId && node.id === activeId) return ACTIVE_COLOR;
  const folder = folderFromId(node.id);
  if (!folder) return COLOR_PALETTE[0];
  return COLOR_PALETTE[hashString(folder) % COLOR_PALETTE.length];
}

function getNodeRadius(node: SimNode, isActive: boolean): number {
  const base = Math.max(6, Math.min(20, 4 + node.weight * 2));
  return isActive ? base + 3 : base;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphCanvas({
  data,
  width,
  height,
  activeNodeId,
  showOrphans,
  onNodeClick,
  onNodeHover,
}: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // -----------------------------------------------------------------------
  // Zoom helpers exposed to parent via imperative handle-style callbacks
  // -----------------------------------------------------------------------

  const fitView = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !simulationRef.current) return;
    const nodes = simulationRef.current.nodes();
    if (nodes.length === 0) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const n of nodes) {
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }

    const padding = 60;
    const dx = maxX - minX + padding * 2;
    const dy = maxY - minY + padding * 2;
    const scale = Math.min(width / dx, height / dy, 2);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const svgSel = d3.select(svg);
    if (zoomRef.current) {
      svgSel
        .transition()
        .duration(500)
        .call(
          zoomRef.current.transform,
          d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(scale)
            .translate(-cx, -cy),
        );
    }
  }, [width, height]);

  const centerOnNode = useCallback(
    (nodeId: string) => {
      const svg = svgRef.current;
      if (!svg || !simulationRef.current) return;
      const node = simulationRef.current
        .nodes()
        .find((n) => n.id === nodeId);
      if (!node) return;

      const svgSel = d3.select(svg);
      if (zoomRef.current) {
        svgSel
          .transition()
          .duration(400)
          .call(
            zoomRef.current.transform,
            d3.zoomIdentity
              .translate(width / 2, height / 2)
              .scale(1.5)
              .translate(-(node.x ?? 0), -(node.y ?? 0)),
          );
      }
    },
    [width, height],
  );

  // Expose helpers on the SVG element for the parent to call
  useEffect(() => {
    const el = svgRef.current as unknown as Record<string, unknown>;
    if (el) {
      el.__fitView = fitView;
      el.__centerOnNode = centerOnNode;
    }
  }, [fitView, centerOnNode]);

  // -----------------------------------------------------------------------
  // Main D3 effect
  // -----------------------------------------------------------------------

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || width === 0 || height === 0) return;

    // --- Prepare data ---
    const edgeSet = new Set<string>();
    for (const e of data.edges) {
      edgeSet.add(e.source);
      edgeSet.add(e.target);
    }

    const filteredNodes: SimNode[] = (
      showOrphans
        ? data.nodes
        : data.nodes.filter((n) => edgeSet.has(n.id) || n.id === activeNodeId)
    ).map((n) => ({ ...n }));

    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges: SimLink[] = data.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));

    const isLarge = filteredNodes.length > LARGE_GRAPH_THRESHOLD;

    // --- Build adjacency for hover highlighting ---
    const adjacency = new Map<string, Set<string>>();
    for (const e of data.edges) {
      if (!adjacency.has(e.source)) adjacency.set(e.source, new Set());
      if (!adjacency.has(e.target)) adjacency.set(e.target, new Set());
      adjacency.get(e.source)!.add(e.target);
      adjacency.get(e.target)!.add(e.source);
    }

    // --- Clear previous ---
    const svgSel = d3.select(svg);
    svgSel.selectAll("*").remove();

    // --- SVG structure ---
    const defs = svgSel.append("defs");

    // Glow filter
    const filter = defs
      .append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    filter
      .append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("result", "blur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const g = svgSel.append("g");

    // --- Edges ---
    const linkGroup = g
      .append("g")
      .attr("class", "links")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(filteredEdges)
      .join("line")
      .attr("stroke", EDGE_COLOR)
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.3);

    // --- Nodes ---
    const nodeGroup = g
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(filteredNodes, (d) => d.id)
      .join("g")
      .attr("cursor", "pointer");

    nodeGroup
      .append("circle")
      .attr("r", (d) =>
        getNodeRadius(d, !!(activeNodeId && d.id === activeNodeId)),
      )
      .attr("fill", (d) => nodeColor(d, activeNodeId))
      .attr("stroke", BG_COLOR)
      .attr("stroke-width", 2);

    // Mark the active node group for CSS pulse animation
    nodeGroup
      .filter((d) => d.id === activeNodeId)
      .classed("graph-node-active", true);

    // --- Labels ---
    const labelGroup = g
      .append("g")
      .attr("class", "labels")
      .selectAll<SVGTextElement, SimNode>("text")
      .data(filteredNodes, (d) => d.id)
      .join("text")
      .text((d) => truncate(d.label, MAX_LABEL_LEN))
      .attr("font-size", 10)
      .attr("fill", LABEL_COLOR)
      .attr("text-anchor", "middle")
      .attr("dy", (d) =>
        getNodeRadius(d, !!(activeNodeId && d.id === activeNodeId)) + 14,
      )
      .attr("pointer-events", "none")
      .style("opacity", (d) =>
        isLarge && d.weight <= 1 && d.id !== activeNodeId ? 0 : 0.8,
      );

    // --- Simulation ---
    const simulation = d3
      .forceSimulation<SimNode>(filteredNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(filteredEdges)
          .id((d) => d.id)
          .distance(80),
      )
      .force("charge", d3.forceManyBody().strength(isLarge ? -120 : -200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((d) => getNodeRadius(d, false) + 5),
      )
      .alphaMin(0.001)
      .alphaDecay(0.0228);

    simulationRef.current = simulation;

    simulation.on("tick", () => {
      linkGroup
        .attr("x1", (d) => ((d.source as SimNode).x ?? 0))
        .attr("y1", (d) => ((d.source as SimNode).y ?? 0))
        .attr("x2", (d) => ((d.target as SimNode).x ?? 0))
        .attr("y2", (d) => ((d.target as SimNode).y ?? 0));

      nodeGroup.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      labelGroup.attr("x", (d) => d.x ?? 0).attr("y", (d) => d.y ?? 0);
    });

    // --- Zoom ---
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", event.transform.toString());
      });

    svgSel.call(zoom);
    zoomRef.current = zoom;

    // --- Drag ---
    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeGroup.call(drag);

    // --- Click ---
    nodeGroup.on("click", (_event: MouseEvent, d: SimNode) => {
      onNodeClick(d.id);
    });

    // --- Double-click: center on node ---
    nodeGroup.on("dblclick", (_event: MouseEvent, d: SimNode) => {
      _event.stopPropagation();
      centerOnNode(d.id);
    });

    // --- Hover ---
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

    nodeGroup
      .on("mouseenter", (event: MouseEvent, d: SimNode) => {
        // Highlight connected
        const connected = adjacency.get(d.id) ?? new Set();

        linkGroup
          .attr("stroke-opacity", (l) => {
            const src = (l.source as SimNode).id;
            const tgt = (l.target as SimNode).id;
            return src === d.id || tgt === d.id ? 0.8 : 0.05;
          })
          .attr("stroke-width", (l) => {
            const src = (l.source as SimNode).id;
            const tgt = (l.target as SimNode).id;
            return src === d.id || tgt === d.id ? 2 : 1;
          });

        nodeGroup.select("circle").attr("opacity", (n: SimNode) =>
          n.id === d.id || connected.has(n.id) ? 1 : 0.15,
        );

        labelGroup.style("opacity", (n: SimNode) =>
          n.id === d.id || connected.has(n.id) ? 1 : 0.05,
        );

        // Glow effect on hovered node
        nodeGroup
          .filter((n) => n.id === d.id)
          .select("circle")
          .attr("filter", "url(#glow)");

        // Show label for hovered node even if hidden
        labelGroup
          .filter((n) => n.id === d.id)
          .style("opacity", 1);

        // Tooltip with delay
        if (hoverTimeout) clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          if (onNodeHover) {
            onNodeHover(d, event.clientX, event.clientY);
          }
        }, 200);
      })
      .on("mousemove", (event: MouseEvent, d: SimNode) => {
        if (onNodeHover) {
          onNodeHover(d, event.clientX, event.clientY);
        }
      })
      .on("mouseleave", () => {
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }

        // Reset
        linkGroup.attr("stroke-opacity", 0.3).attr("stroke-width", 1);
        nodeGroup.select("circle").attr("opacity", 1).attr("filter", null);
        labelGroup.style("opacity", (d: SimNode) =>
          isLarge && d.weight <= 1 && d.id !== activeNodeId ? 0 : 0.8,
        );

        if (onNodeHover) onNodeHover(null, 0, 0);
      });

    // --- Cleanup ---
    return () => {
      simulation.stop();
      if (hoverTimeout) clearTimeout(hoverTimeout);
    };
  }, [
    data,
    width,
    height,
    activeNodeId,
    showOrphans,
    onNodeClick,
    onNodeHover,
    centerOnNode,
  ]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ display: "block" }}
    />
  );
}
