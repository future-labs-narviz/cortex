import { useState } from "react";
import { Eye, EyeOff, Maximize, LocateFixed } from "lucide-react";
import { useGraphStore } from "@/stores/graphStore";

interface GraphControlsProps {
  nodeCount: number;
  edgeCount: number;
  onFitView: () => void;
  onCenterActive: () => void;
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        borderRadius: 'var(--radius-md)',
        color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
        background: hovered ? 'var(--muted)' : 'transparent',
        transition: 'all 150ms',
        cursor: 'pointer',
        border: 'none',
      }}
    >
      {children}
    </button>
  );
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

  const [localHover, setLocalHover] = useState(false);
  const [globalHover, setGlobalHover] = useState(false);

  const modeButtonStyle = (active: boolean, hovered: boolean): React.CSSProperties => ({
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 4,
    paddingBottom: 4,
    fontSize: 10,
    fontWeight: 500,
    transition: 'all 150ms',
    cursor: 'pointer',
    border: 'none',
    background: active ? 'var(--accent-soft)' : 'transparent',
    color: active ? 'var(--accent)' : hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 8,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-elevated)',
        opacity: 0.95,
        WebkitBackdropFilter: 'blur(12px)',
        backdropFilter: 'blur(12px)',
        boxShadow: 'var(--shadow-md)',
        zIndex: 10,
      }}
    >
      {/* Mode toggle */}
      <div
        style={{
          display: 'flex',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => setMode("local")}
          onMouseEnter={() => setLocalHover(true)}
          onMouseLeave={() => setLocalHover(false)}
          style={modeButtonStyle(mode === "local", localHover)}
        >
          Local
        </button>
        <button
          onClick={() => setMode("global")}
          onMouseEnter={() => setGlobalHover(true)}
          onMouseLeave={() => setGlobalHover(false)}
          style={modeButtonStyle(mode === "global", globalHover)}
        >
          Global
        </button>
      </div>

      {/* Depth slider - local mode only */}
      {mode === "local" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: '"JetBrains Mono", "SF Mono", monospace',
            }}
          >
            Depth: {depth}
          </label>
          <input
            type="range"
            min={1}
            max={3}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            style={{
              width: '100%',
              height: 4,
              borderRadius: 9999,
              cursor: 'pointer',
              accentColor: 'var(--accent)',
            }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 4 }}>
        <IconButton onClick={onCenterActive} title="Center on active note">
          <LocateFixed size={13} />
        </IconButton>
        <IconButton onClick={onFitView} title="Fit view">
          <Maximize size={13} />
        </IconButton>
        <IconButton onClick={toggleOrphans} title={showOrphans ? "Hide orphans" : "Show orphans"}>
          {showOrphans ? <Eye size={13} /> : <EyeOff size={13} />}
        </IconButton>
      </div>

      {/* Stats */}
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          textAlign: 'center',
          fontFamily: '"JetBrains Mono", "SF Mono", monospace',
        }}
      >
        {nodeCount} notes, {edgeCount} links
      </div>
    </div>
  );
}
