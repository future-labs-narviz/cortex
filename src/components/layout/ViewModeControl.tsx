import { useState } from "react";
import { Pencil, Columns2, Eye } from "lucide-react";
import { useLayoutStore } from "@/stores/layoutStore";
import type { SheetId, ViewMode } from "@/lib/types/layout";

interface ViewModeControlProps {
  sheetId: SheetId;
}

const modes: { mode: ViewMode; icon: typeof Pencil; label: string }[] = [
  { mode: "edit", icon: Pencil, label: "Edit" },
  { mode: "split", icon: Columns2, label: "Split" },
  { mode: "preview", icon: Eye, label: "Read" },
];

const BUTTON_W = 56;
const BUTTON_H = 24;

export function ViewModeControl({ sheetId }: ViewModeControlProps) {
  const sheet = useLayoutStore((s) => s.sheets[sheetId]);
  const setViewMode = useLayoutStore((s) => s.setViewMode);

  if (!sheet || sheet.content.kind !== "file") return null;

  const currentMode = sheet.content.viewMode;
  const activeIndex = modes.findIndex((m) => m.mode === currentMode);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 28,
        borderRadius: 14,
        background: "var(--muted)",
        padding: 2,
        position: "relative",
        gap: 0,
      }}
    >
      {/* Sliding active indicator */}
      <div
        style={{
          position: "absolute",
          top: 2,
          left: 2 + activeIndex * BUTTON_W,
          width: BUTTON_W,
          height: BUTTON_H,
          borderRadius: 12,
          background: "var(--accent-soft)",
          transition: "left 200ms cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 0,
        }}
      />

      {modes.map(({ mode, icon: Icon, label }) => (
        <ModeButton
          key={mode}
          icon={<Icon size={12} />}
          label={label}
          isActive={mode === currentMode}
          onClick={() => setViewMode(sheetId, mode)}
        />
      ))}
    </div>
  );
}

function ModeButton({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        width: BUTTON_W,
        height: BUTTON_H,
        borderRadius: 12,
        border: "none",
        cursor: "pointer",
        background: "transparent",
        color: isActive
          ? "var(--accent)"
          : hovered
            ? "var(--text-secondary)"
            : "var(--text-muted)",
        fontSize: 11,
        fontWeight: isActive ? 500 : 400,
        transition: "color 150ms",
        position: "relative",
        zIndex: 1,
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
