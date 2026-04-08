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
        className="flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-150 cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)]"
        aria-label="Open daily note"
      >
        <CalendarDays size={18} strokeWidth={1.5} />
      </button>
    </Tooltip>
  );
}
