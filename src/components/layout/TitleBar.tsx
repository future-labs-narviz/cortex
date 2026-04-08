import { PanelLeft } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

const TITLE_COLORS = [
  '#3b82f6', // C — blue
  '#8b5cf6', // o — purple
  '#06b6d4', // r — cyan
  '#10b981', // t — green
  '#f59e0b', // e — amber
  '#ef4444', // x — red
];

export function TitleBar() {
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 40,
        paddingLeft: 80, // macOS traffic light spacing
        paddingRight: 16,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        userSelect: 'none',
      }}
      data-tauri-drag-region
    >
      {/* Cortex title — colored letters */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.06em',
          fontFamily: '"JetBrains Mono", monospace',
          marginRight: 16,
        }}
        data-tauri-drag-region
      >
        {'Cortex'.split('').map((letter, i) => (
          <span key={i} style={{ color: TITLE_COLORS[i] }}>{letter}</span>
        ))}
      </span>

      {/* Sidebar toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleSidebar();
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--muted)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 'var(--radius-md)',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          transition: 'all 150ms',
        }}
        aria-label="Toggle sidebar"
      >
        <PanelLeft style={{ width: 15, height: 15 }} />
      </button>

      {/* Spacer for dragging */}
      <div style={{ flex: 1 }} data-tauri-drag-region />
    </div>
  );
}
