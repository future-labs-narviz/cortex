import { useEffect } from "react";
import { useGraphStore } from "@/stores/graphStore";

export function KgStatsBar() {
  const kgStats = useGraphStore((s) => s.kgStats);
  const graphLayer = useGraphStore((s) => s.graphLayer);
  const fetchKgStats = useGraphStore((s) => s.fetchKgStats);

  useEffect(() => {
    if (graphLayer !== "wikilinks") {
      fetchKgStats();
    }
  }, [graphLayer, fetchKgStats]);

  if (graphLayer === "wikilinks" || !kgStats) return null;

  const total = kgStats.processed_count + kgStats.unprocessed_count;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "6px 14px",
        border: "1px solid var(--border)",
        borderRadius: 20,
        background: "var(--bg-elevated)",
        opacity: 0.95,
        WebkitBackdropFilter: "blur(12px)",
        backdropFilter: "blur(12px)",
        boxShadow: "var(--shadow-md)",
        zIndex: 10,
        fontSize: 11,
        fontFamily: '"JetBrains Mono", "SF Mono", monospace',
        color: "var(--text-muted)",
        whiteSpace: "nowrap" as const,
      }}
    >
      <span>
        <strong style={{ color: "var(--accent)" }}>{kgStats.entity_count}</strong> entities
      </span>
      <span style={{ color: "var(--border)" }}>&middot;</span>
      <span>
        <strong style={{ color: "var(--purple)" }}>{kgStats.relation_count}</strong> relations
      </span>
      <span style={{ color: "var(--border)" }}>&middot;</span>
      <span>
        <strong style={{ color: "var(--green)" }}>{kgStats.processed_count}</strong>/{total} notes
      </span>
      {kgStats.unprocessed_count > 0 && (
        <>
          <span style={{ color: "var(--border)" }}>&middot;</span>
          <span style={{ color: "var(--orange)", fontSize: 10 }}>
            {kgStats.unprocessed_count} remaining
          </span>
        </>
      )}
    </div>
  );
}
