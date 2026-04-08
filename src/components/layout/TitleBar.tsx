import { PanelLeft } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

export function TitleBar() {
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);

  return (
    <div
      className="flex items-center h-10 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] select-none"
      data-tauri-drag-region
    >
      {/* macOS traffic light spacing */}
      <div className="w-[70px] flex-shrink-0" data-tauri-drag-region />

      <button
        onClick={toggleSidebar}
        className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors duration-150 cursor-pointer"
        aria-label="Toggle sidebar"
      >
        <PanelLeft size={16} />
      </button>

      <div
        className="flex-1 text-center text-xs font-medium text-[var(--text-muted)] tracking-wide"
        data-tauri-drag-region
      >
        Cortex
      </div>

      {/* Balance the right side */}
      <div className="w-[70px] flex-shrink-0" />
    </div>
  );
}
