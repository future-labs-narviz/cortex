import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { GraphData, GraphNode, KgGraphData, EntityType } from "@/lib/types";
import { useSettingsStore } from "@/stores/settingsStore";

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
  predicate?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GraphCanvasProps {
  data: GraphData;
  typedData?: KgGraphData | null;
  width: number;
  height: number;
  activeNodeId?: string;
  showOrphans: boolean;
  onNodeClick: (nodeId: string) => void;
  onNodeHover?: (node: GraphNode | null, x: number, y: number) => void;
  onEntityClick?: (entityName: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const getCssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function buildColorPalette(): string[] {
  return [
    getCssVar("--accent"),
    getCssVar("--purple"),
    getCssVar("--green"),
    getCssVar("--orange"),
    getCssVar("--cyan"),
    getCssVar("--red"),
    getCssVar("--yellow"),
  ];
}

function getActiveColor(): string {
  return getCssVar("--orange");
}

function getEdgeColor(): string {
  return getCssVar("--border");
}

function getBgColor(): string {
  return getCssVar("--bg-primary");
}

function getLabelColor(): string {
  return getCssVar("--text-secondary");
}

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

function nodeColor(node: SimNode, palette: string[], activeColor: string, activeId?: string): string {
  if (activeId && node.id === activeId) return activeColor;
  const folder = folderFromId(node.id);
  if (!folder) return palette[0];
  return palette[hashString(folder) % palette.length];
}

function getNodeRadius(node: SimNode, isActive: boolean): number {
  const base = Math.max(6, Math.min(20, 4 + node.weight * 2));
  return isActive ? base + 3 : base;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

// ---------------------------------------------------------------------------
// Typed graph helpers
// ---------------------------------------------------------------------------

const PREDICATE_COLORS: Record<string, string> = {
  decided: "var(--purple)",
  built_with: "var(--accent)",
  depends_on: "var(--orange)",
  supersedes: "var(--red)",
  caused: "var(--yellow)",
  led_to: "var(--green)",
  extracted_from: "var(--cyan)",
};
const DEFAULT_EDGE_COLOR = "var(--text-muted)";

const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
  Person: "var(--accent)",
  Project: "var(--purple)",
  Technology: "var(--cyan)",
  Decision: "var(--orange)",
  Pattern: "var(--green)",
  Organization: "var(--yellow)",
  Concept: "var(--text-muted)",
};

function getEntityShape(entityType: EntityType, radius: number): string {
  const r = radius;
  switch (entityType) {
    case "Person":
      return `M 0,${-r} A ${r},${r} 0 1,1 0,${r} A ${r},${r} 0 1,1 0,${-r}`;
    case "Project": {
      // hexagon
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        pts.push(`${r * Math.cos(angle)},${r * Math.sin(angle)}`);
      }
      return `M ${pts[0]} L ${pts[1]} L ${pts[2]} L ${pts[3]} L ${pts[4]} L ${pts[5]} Z`;
    }
    case "Technology":
      return `M ${-r},${-r} L ${r},${-r} L ${r},${r} L ${-r},${r} Z`;
    case "Decision":
      return `M 0,${-r} L ${r},0 L 0,${r} L ${-r},0 Z`;
    case "Pattern":
      return `M 0,${-r} L ${r},${r} L ${-r},${r} Z`;
    case "Organization": {
      // pentagon
      const pts: string[] = [];
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
        pts.push(`${r * Math.cos(angle)},${r * Math.sin(angle)}`);
      }
      return `M ${pts[0]} L ${pts[1]} L ${pts[2]} L ${pts[3]} L ${pts[4]} Z`;
    }
    case "Concept":
      return `M ${-r + 2},${-r} L ${r - 2},${-r} Q ${r},${-r} ${r},${-r + 2} L ${r},${r - 2} Q ${r},${r} ${r - 2},${r} L ${-r + 2},${r} Q ${-r},${r} ${-r},${r - 2} L ${-r},${-r + 2} Q ${-r},${-r} ${-r + 2},${-r} Z`;
    default:
      return `M 0,${-r} A ${r},${r} 0 1,1 0,${r} A ${r},${r} 0 1,1 0,${-r}`;
  }
}

const ENTITY_TYPE_LABELS: { type: EntityType; label: string }[] = [
  { type: "Person", label: "Person" },
  { type: "Project", label: "Project" },
  { type: "Technology", label: "Technology" },
  { type: "Decision", label: "Decision" },
  { type: "Pattern", label: "Pattern" },
  { type: "Organization", label: "Organization" },
  { type: "Concept", label: "Concept" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphCanvas({
  data,
  typedData,
  width,
  height,
  activeNodeId,
  showOrphans,
  onNodeClick,
  onNodeHover,
  onEntityClick,
}: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const currentTheme = useSettingsStore((s) => s.theme);

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
  // Determine if we should use the typed view
  // -----------------------------------------------------------------------

  const useTyped = !!(typedData && typedData.entities.length > 0);

  // Build a map from entity name → entity type for typed view
  const entityTypeMap = useRef(new Map<string, EntityType>());
  if (useTyped && typedData) {
    entityTypeMap.current.clear();
    for (const e of typedData.entities) {
      entityTypeMap.current.set(e.name, e.entity_type);
    }
  }

  // -----------------------------------------------------------------------
  // Main D3 effect
  // -----------------------------------------------------------------------

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || width === 0 || height === 0) return;

    // --- Read CSS variables at render time for D3 ---
    const palette = buildColorPalette();
    const activeColor = getActiveColor();
    const edgeColor = getEdgeColor();
    const bgColor = getBgColor();
    const labelColor = getLabelColor();

    // --- Prepare data (typed or regular) ---
    let filteredNodes: SimNode[];
    let filteredEdges: SimLink[];

    if (useTyped && typedData) {
      // Typed knowledge graph mode
      filteredNodes = typedData.entities.map((e) => ({
        id: e.name,
        label: e.name,
        weight: e.source_notes.length,
      }));

      const nodeIds = new Set(filteredNodes.map((n) => n.id));
      filteredEdges = typedData.relations
        .filter((r) => nodeIds.has(r.source) && nodeIds.has(r.target))
        .map((r) => ({
          source: r.source,
          target: r.target,
          predicate: r.predicate,
        }));
    } else {
      // Regular graph mode
      const edgeSet = new Set<string>();
      for (const e of data.edges) {
        edgeSet.add(e.source);
        edgeSet.add(e.target);
      }

      filteredNodes = (
        showOrphans
          ? data.nodes
          : data.nodes.filter((n) => edgeSet.has(n.id) || n.id === activeNodeId)
      ).map((n) => ({ ...n }));

      const nodeIds = new Set(filteredNodes.map((n) => n.id));
      filteredEdges = data.edges
        .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
        .map((e) => ({ source: e.source, target: e.target }));
    }

    const isLarge = filteredNodes.length > LARGE_GRAPH_THRESHOLD;

    // --- Build adjacency for hover highlighting ---
    const adjacency = new Map<string, Set<string>>();
    for (const e of filteredEdges) {
      const src = typeof e.source === "string" ? e.source : (e.source as SimNode).id;
      const tgt = typeof e.target === "string" ? e.target : (e.target as SimNode).id;
      if (!adjacency.has(src)) adjacency.set(src, new Set());
      if (!adjacency.has(tgt)) adjacency.set(tgt, new Set());
      adjacency.get(src)!.add(tgt);
      adjacency.get(tgt)!.add(src);
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
      .attr("stroke", (d) => {
        if (useTyped && d.predicate) {
          return PREDICATE_COLORS[d.predicate] ?? DEFAULT_EDGE_COLOR;
        }
        return edgeColor;
      })
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.4);

    // --- Edge label group for hover (typed mode) ---
    const edgeLabelGroup = g.append("g").attr("class", "edge-labels");

    // --- Nodes ---
    const nodeGroup = g
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(filteredNodes, (d) => d.id)
      .join("g")
      .attr("cursor", "pointer");

    if (useTyped) {
      // Typed mode: use SVG paths for different entity shapes
      nodeGroup
        .append("path")
        .attr("d", (d) => {
          const eType = entityTypeMap.current.get(d.id) ?? "Concept";
          const r = getNodeRadius(d, !!(activeNodeId && d.id === activeNodeId));
          return getEntityShape(eType, r);
        })
        .attr("fill", (d) => {
          const eType = entityTypeMap.current.get(d.id) ?? "Concept";
          return ENTITY_TYPE_COLORS[eType];
        })
        .attr("stroke", bgColor)
        .attr("stroke-width", 2)
        .attr("opacity", 0.85);
    } else {
      // Regular mode: circles
      nodeGroup
        .append("circle")
        .attr("r", (d) =>
          getNodeRadius(d, !!(activeNodeId && d.id === activeNodeId)),
        )
        .attr("fill", (d) => nodeColor(d, palette, activeColor, activeNodeId))
        .attr("stroke", bgColor)
        .attr("stroke-width", 2);
    }

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
      .attr("fill", labelColor)
      .attr("text-anchor", "middle")
      .attr("dy", (d) =>
        getNodeRadius(d, !!(activeNodeId && d.id === activeNodeId)) + 14,
      )
      .attr("pointer-events", "none")
      .style("opacity", (d) =>
        isLarge && d.weight <= 1 && d.id !== activeNodeId ? 0 : 0.8,
      );

    // Legend removed — folder colors shown in React overlay instead

    // --- Simulation ---
    // Stronger repulsion + wider collision to prevent overlap on small screens
    const chargeStrength = isLarge ? -180 : -300;
    const linkDist = isLarge ? 100 : 120;
    const collisionPad = isLarge ? 8 : 12;

    const simulation = d3
      .forceSimulation<SimNode>(filteredNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(filteredEdges)
          .id((d) => d.id)
          .distance(linkDist),
      )
      .force("charge", d3.forceManyBody().strength(chargeStrength))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((d) => getNodeRadius(d, false) + collisionPad),
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
      if (useTyped && onEntityClick) {
        onEntityClick(d.id);
      } else {
        onNodeClick(d.id);
      }
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

        // Show edge labels on hover (typed mode)
        if (useTyped) {
          edgeLabelGroup.selectAll("*").remove();
          filteredEdges.forEach((l) => {
            const src = l.source as SimNode;
            const tgt = l.target as SimNode;
            if (src.id === d.id || tgt.id === d.id) {
              if (l.predicate) {
                const mx = ((src.x ?? 0) + (tgt.x ?? 0)) / 2;
                const my = ((src.y ?? 0) + (tgt.y ?? 0)) / 2;
                edgeLabelGroup.append("text")
                  .attr("x", mx)
                  .attr("y", my)
                  .attr("font-size", 9)
                  .attr("fill", PREDICATE_COLORS[l.predicate] ?? labelColor)
                  .attr("text-anchor", "middle")
                  .attr("dy", -4)
                  .attr("pointer-events", "none")
                  .text(l.predicate);
              }
            }
          });
        }

        const shapeSelector = useTyped ? "path" : "circle";

        nodeGroup.select(shapeSelector).attr("opacity", (n: SimNode) =>
          n.id === d.id || connected.has(n.id) ? 1 : 0.15,
        );

        labelGroup.style("opacity", (n: SimNode) =>
          n.id === d.id || connected.has(n.id) ? 1 : 0.05,
        );

        // Glow effect on hovered node
        nodeGroup
          .filter((n) => n.id === d.id)
          .select(shapeSelector)
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

        const shapeSelector = useTyped ? "path" : "circle";

        // Clear edge labels
        if (useTyped) {
          edgeLabelGroup.selectAll("*").remove();
        }

        // Reset
        linkGroup.attr("stroke-opacity", 0.4).attr("stroke-width", 1);
        nodeGroup.select(shapeSelector).attr("opacity", useTyped ? 0.85 : 1).attr("filter", null);
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
    typedData,
    useTyped,
    width,
    height,
    activeNodeId,
    showOrphans,
    onNodeClick,
    onNodeHover,
    onEntityClick,
    centerOnNode,
    currentTheme,
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
