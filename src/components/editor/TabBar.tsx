import { FileText } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useCallback } from "react";

interface TabBarProps {
  paneIndex?: number;
}

export function TabBar({ paneIndex }: TabBarProps) {
  const panes = useEditorStore((s) => s.panes);
  const activePaneIndex = useEditorStore((s) => s.activePaneIndex);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const setActivePane = useEditorStore((s) => s.setActivePane);

  // Use the specified pane or the active one
  const idx = paneIndex ?? activePaneIndex;
  const pane = panes[idx];
  const tabs = pane?.tabs ?? [];
  const activeTabId = pane?.activeTabId ?? null;

  const handleClick = useCallback(
    (tabId: string) => {
      if (idx !== activePaneIndex) {
        setActivePane(idx);
      }
      // Defer setActiveTab to next tick so setActivePane takes effect first
      setTimeout(() => {
        useEditorStore.getState().setActiveTab(tabId);
      }, 0);
    },
    [idx, activePaneIndex, setActivePane],
  );

  const handleClose = useCallback(
    (tabId: string) => {
      if (idx !== activePaneIndex) {
        setActivePane(idx);
      }
      setTimeout(() => {
        useEditorStore.getState().closeTab(tabId);
      }, 0);
    },
    [idx, activePaneIndex, setActivePane],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      // Middle-click to close
      if (e.button === 1) {
        e.preventDefault();
        handleClose(tabId);
      }
    },
    [handleClose],
  );

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center h-9 bg-[var(--bg-secondary)] border-b border-[var(--border)] overflow-x-auto shrink-0">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`flex items-center gap-1.5 px-3 h-full text-xs border-r border-[var(--border)] cursor-pointer transition-colors duration-100 select-none ${
            tab.id === activeTabId
              ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          }`}
          onClick={() => handleClick(tab.id)}
          onMouseDown={(e) => handleMouseDown(e, tab.id)}
        >
          <FileText size={12} className="shrink-0" />
          <span className="truncate max-w-[120px]">{tab.title}</span>
          {tab.isDirty && (
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose(tab.id);
            }}
            className="ml-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
            aria-label={`Close ${tab.title}`}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
