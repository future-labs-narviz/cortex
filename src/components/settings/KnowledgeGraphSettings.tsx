import { useState, useEffect, useCallback } from "react";
import { Brain, Sparkles, BarChart3, Layers } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useGraphStore } from "@/stores/graphStore";
import type { KgStats, GraphLayer } from "@/lib/types";

const LAYERS: { id: GraphLayer; label: string; description: string }[] = [
  { id: "wikilinks", label: "Wikilinks", description: "Explicit [[links]] between notes" },
  { id: "typed", label: "Typed", description: "Claude-extracted entities and relations" },
  { id: "both", label: "Both", description: "Overlay typed graph on wikilinks" },
];

export function KnowledgeGraphSettings() {
  const [stats, setStats] = useState<KgStats | null>(null);
  const graphLayer = useGraphStore((s) => s.graphLayer);
  const setGraphLayer = useGraphStore((s) => s.setGraphLayer);
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await invoke<KgStats>("get_kg_stats", {});
      setStats(data);
    } catch {
      // Stats unavailable
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Brain size={18} style={{ color: "var(--accent)" }} />
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          Knowledge Graph
        </h3>
      </div>

      {/* Graph Layer Toggle */}
      <div style={{
        background: "var(--bg-tertiary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 16,
      }}>
        <label style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase" as const,
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
          marginBottom: 10,
          display: "block",
        }}>
          <Layers size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
          Graph Layer
        </label>
        <div style={{
          display: "flex",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "var(--muted)",
        }}>
          {LAYERS.map((layer) => {
            const isActive = graphLayer === layer.id;
            const isHovered = hoveredLayer === layer.id;
            return (
              <button
                key={layer.id}
                onClick={() => setGraphLayer(layer.id)}
                onMouseEnter={() => setHoveredLayer(layer.id)}
                onMouseLeave={() => setHoveredLayer(null)}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  fontSize: 11,
                  fontWeight: 500,
                  transition: "all 150ms",
                  cursor: "pointer",
                  border: "none",
                  background: isActive ? "var(--accent-soft)" : "transparent",
                  color: isActive
                    ? "var(--accent)"
                    : isHovered
                      ? "var(--text-secondary)"
                      : "var(--text-muted)",
                }}
              >
                {layer.label}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0 0" }}>
          {LAYERS.find((l) => l.id === graphLayer)?.description}
        </p>
      </div>

      {/* How it works */}
      <div style={{
        background: "var(--bg-tertiary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 16,
      }}>
        <label style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase" as const,
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
          marginBottom: 8,
          display: "block",
        }}>
          <Sparkles size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
          How it works
        </label>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px 0", lineHeight: 1.5 }}>
          Claude Code extracts entities and relations from your notes via MCP tools. No API key needed — Claude Code IS the intelligence.
        </p>
        <div style={{
          background: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "10px 14px",
          fontFamily: '"JetBrains Mono", "SF Mono", monospace',
          fontSize: 12,
          color: "var(--accent)",
        }}>
          /cortex extract
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0 0" }}>
          Run this command in Claude Code to extract entities from unprocessed notes.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: 16,
        }}>
          <label style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase" as const,
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            marginBottom: 12,
            display: "block",
          }}>
            <BarChart3 size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Stats
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <StatCell value={stats.entity_count} label="Entities" color="var(--accent)" />
            <StatCell value={stats.relation_count} label="Relations" color="var(--purple)" />
            <StatCell value={stats.processed_count} label="Processed" color="var(--green)" />
            <StatCell value={stats.unprocessed_count} label="Remaining" color="var(--orange)" />
          </div>
          <button
            onClick={fetchStats}
            style={{
              marginTop: 12,
              width: "100%",
              background: "var(--bg-primary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "6px 16px",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Refresh Stats
          </button>
        </div>
      )}
    </div>
  );
}

function StatCell({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      textAlign: "center" as const,
      padding: 12,
      background: "var(--bg-primary)",
      borderRadius: "var(--radius-md)",
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}
