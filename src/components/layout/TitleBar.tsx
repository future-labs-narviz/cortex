import { PanelLeft } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

export function TitleBar() {
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);

  return (
    <div
      className="flex items-center select-none"
      style={{ height: 40, paddingLeft: 80, paddingRight: 16, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
      data-tauri-drag-region
    >
      {/* App title — far left, minimal */}
      <span
        style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em', marginRight: 12 }}
        data-tauri-drag-region
      >
        Cortex
      </span>

      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        style={{ padding: 6, borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center' }}
        aria-label="Toggle sidebar"
      >
        <PanelLeft style={{ width: 15, height: 15 }} />
      </button>

      {/* Spacer for dragging */}
      <div style={{ flex: 1 }} data-tauri-drag-region />
    </div>
  );
}
