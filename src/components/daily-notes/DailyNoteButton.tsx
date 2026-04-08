import { CalendarDays } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { Tooltip } from "@/components/ui/Tooltip";

function formatToday(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DailyNoteButton() {
  const setActiveFile = useVaultStore((s) => s.setActiveFile);
  const openTab = useEditorStore((s) => s.openTab);
  const vaultPath = useVaultStore((s) => s.vaultPath);

  const handleClick = async () => {
    if (!vaultPath) return;
    try {
      const path = await invoke<string>("create_daily_note");
      setActiveFile(path);
      openTab(path, "");
    } catch (err) {
      console.warn("[Cortex] create_daily_note failed:", err);
    }
  };

  return (
    <Tooltip content={`Daily Note - ${formatToday()}`} side="right">
      <button
        onClick={handleClick}
        className="flex items-center justify-center h-12 w-12 p-0 m-1 rounded-[var(--radius-lg)] transition-all duration-200 cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
        aria-label="Open daily note"
      >
        <CalendarDays size={18} strokeWidth={1.5} />
      </button>
    </Tooltip>
  );
}
