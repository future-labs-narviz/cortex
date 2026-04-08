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
    <div className="flex items-center h-9 bg-[var(--bg-secondary)] border-b border-[var(--border)] overflow-x-auto overflow-y-hidden shrink-0 scrollbar-none">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          tabIndex={0}
          className={`flex items-center gap-1.5 px-3 h-full text-xs border-r border-[var(--border)] cursor-pointer transition-colors duration-150 ease-out select-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent)] ${
            tab.id === activeTabId
              ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          }`}
          onClick={() => handleClick(tab.id)}
          onMouseDown={(e) => handleMouseDown(e, tab.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick(tab.id);
            }
          }}
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
            className="ml-1 rounded-[4px] w-5 h-5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors duration-150 ease-out cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 focus:ring-offset-[var(--bg-primary)]"
            aria-label={`Close ${tab.title}`}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
