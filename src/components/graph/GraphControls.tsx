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
      className="graph-controls absolute top-3 right-3 flex flex-col gap-2 p-2 rounded-lg border"
      style={{
        background: "color-mix(in srgb, var(--bg-secondary) 85%, transparent)",
        borderColor: "var(--border)",
        zIndex: 10,
      }}
    >
      {/* Mode toggle */}
      <div className="flex rounded-md overflow-hidden border border-[var(--border)]">
        <button
          onClick={() => setMode("local")}
          className={`px-2.5 py-1 text-[10px] font-medium transition-all duration-150 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)] ${
            mode === "local"
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          Local
        </button>
        <button
          onClick={() => setMode("global")}
          className={`px-2.5 py-1 text-[10px] font-medium transition-all duration-150 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)] ${
            mode === "global"
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          Global
        </button>
      </div>

      {/* Depth slider - local mode only */}
      {mode === "local" && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[var(--text-muted)]">
            Depth: {depth}
          </label>
          <input
            type="range"
            min={1}
            max={3}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "var(--accent)" }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-1">
        <button
          onClick={onCenterActive}
          className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all duration-150 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)]"
          title="Center on active note"
        >
          <LocateFixed size={13} />
        </button>
        <button
          onClick={onFitView}
          className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all duration-150 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)]"
          title="Fit view"
        >
          <Maximize size={13} />
        </button>
        <button
          onClick={toggleOrphans}
          className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all duration-150 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-secondary)]"
          title={showOrphans ? "Hide orphans" : "Show orphans"}
        >
          {showOrphans ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
      </div>

      {/* Stats */}
      <div className="text-[10px] text-[var(--text-muted)] text-center">
        {nodeCount} notes, {edgeCount} links
      </div>
    </div>
  );
}
