import { useState } from "react";
import { Eye, EyeOff, Maximize, LocateFixed } from "lucide-react";
import { useGraphStore } from "@/stores/graphStore";

interface GraphControlsProps {
  nodeCount: number;
  edgeCount: number;
  onFitView: () => void;
  onCenterActive: () => void;
}

export function GraphControls({
  nodeCount,
  edgeCount,
  onFitView,
  onCenterActive,
}: GraphControlsProps) {
  const mode = useGraphStore((s) => s.mode);
  const depth = useGraphStore((s) => s.depth);
  const showOrphans = useGraphStore((s) => s.showOrphans);
  const setMode = useGraphStore((s) => s.setMode);
  const setDepth = useGraphStore((s) => s.setDepth);
  const toggleOrphans = useGraphStore((s) => s.toggleOrphans);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 10,
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--bg-elevated)",
        opacity: 0.95,
        WebkitBackdropFilter: "blur(12px)",
        backdropFilter: "blur(12px)",
        boxShadow: "var(--shadow-md)",
        zIndex: 10,
        minWidth: 120,
      }}
    >
      {/* Mode toggle — segmented pill */}
      <div
        style={{
          display: "flex",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "var(--muted)",
        }}
      >
        <ModeButton
          label="Local"
          active={mode === "local"}
          onClick={() => setMode("local")}
        />
        <ModeButton
          label="Global"
          active={mode === "global"}
          onClick={() => setMode("global")}
        />
      </div>

      {/* Depth slider — local mode only */}
      {mode === "local" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              Depth
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--accent)",
                fontWeight: 600,
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              {depth}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            style={{
              width: "100%",
              height: 4,
              borderRadius: 9999,
              cursor: "pointer",
              accentColor: "var(--accent)",
            }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
        <IconButton
          onClick={onCenterActive}
          title="Center on active note"
        >
          <LocateFixed size={13} />
        </IconButton>
        <IconButton onClick={onFitView} title="Fit view">
          <Maximize size={13} />
        </IconButton>
        <IconButton
          onClick={toggleOrphans}
          title={showOrphans ? "Hide orphans" : "Show orphans"}
        >
          {showOrphans ? <Eye size={13} /> : <EyeOff size={13} />}
        </IconButton>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          fontSize: 10,
          color: "var(--text-muted)",
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        <span>
          <strong style={{ color: "var(--text-secondary)" }}>
            {nodeCount}
          </strong>{" "}
          notes
        </span>
        <span style={{ color: "var(--border)" }}>|</span>
        <span>
          <strong style={{ color: "var(--text-secondary)" }}>
            {edgeCount}
          </strong>{" "}
          links
        </span>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        paddingTop: 5,
        paddingBottom: 5,
        fontSize: 10,
        fontWeight: 500,
        transition: "all 150ms",
        cursor: "pointer",
        border: "none",
        background: active ? "var(--accent-soft)" : "transparent",
        color: active
          ? "var(--accent)"
          : hovered
            ? "var(--text-secondary)"
            : "var(--text-muted)",
      }}
    >
      {label}
    </button>
  );
}

function IconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: 6,
        color: hovered ? "var(--text-secondary)" : "var(--text-muted)",
        background: hovered ? "var(--muted)" : "transparent",
        transition: "all 150ms",
        cursor: "pointer",
        border: "none",
      }}
    >
      {children}
    </button>
  );
}
