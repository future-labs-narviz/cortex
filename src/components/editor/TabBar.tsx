import { useState } from "react";
import { FileText, X } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useCallback } from "react";

interface TabBarProps {
  paneIndex?: number;
}

export function TabBar({ paneIndex }: TabBarProps) {
  const panes = useEditorStore((s) => s.panes);
  const activePaneIndex = useEditorStore((s) => s.activePaneIndex);
  const closeTab = useEditorStore((s) => s.closeTab);
  const setActivePane = useEditorStore((s) => s.setActivePane);

  const idx = paneIndex ?? activePaneIndex;
  const pane = panes[idx];
  const tabs = pane?.tabs ?? [];
  const activeTabId = pane?.activeTabId ?? null;

  const handleClick = useCallback(
    (tabId: string) => {
      if (idx !== activePaneIndex) {
        setActivePane(idx);
      }
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
      if (e.button === 1) {
        e.preventDefault();
        handleClose(tabId);
      }
    },
    [handleClose],
  );

  if (tabs.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        height: 44,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        overflowY: 'hidden',
        flexShrink: 0,
        paddingLeft: 4,
        gap: 2,
      }}
      className="scrollbar-none"
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          title={tab.title}
          isDirty={tab.isDirty}
          isActive={tab.id === activeTabId}
          onClick={() => handleClick(tab.id)}
          onClose={() => handleClose(tab.id)}
          onMouseDown={(e) => handleMouseDown(e, tab.id)}
        />
      ))}
    </div>
  );
}

function Tab({
  title,
  isDirty,
  isActive,
  onClick,
  onClose,
  onMouseDown,
}: {
  title: string;
  isDirty: boolean;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);

  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 12,
        paddingRight: 8,
        height: 36,
        maxWidth: 180,
        minWidth: 0,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'background 150ms',
        position: 'relative',
        background: isActive
          ? 'var(--bg-primary)'
          : hovered
            ? 'var(--bg-tertiary)'
            : 'transparent',
        color: isActive
          ? 'var(--text-primary)'
          : 'var(--text-muted)',
      }}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Active bottom accent line */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 8,
            right: 8,
            height: 2,
            borderRadius: 1,
            background: 'var(--accent)',
          }}
        />
      )}

      <FileText
        size={14}
        style={{
          flexShrink: 0,
          color: isActive ? 'var(--text-secondary)' : 'var(--text-muted)',
        }}
      />

      <span
        style={{
          fontSize: 12,
          fontWeight: isActive ? 500 : 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
        }}
      >
        {title}
      </span>

      {isDirty && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--accent)',
            flexShrink: 0,
          }}
        />
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onMouseEnter={() => setCloseHovered(true)}
        onMouseLeave={() => setCloseHovered(false)}
        aria-label={`Close ${title}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          borderRadius: 4,
          border: 'none',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 150ms',
          background: closeHovered ? 'var(--muted-strong)' : 'transparent',
          color: closeHovered ? 'var(--text-primary)' : 'var(--text-muted)',
          opacity: hovered || isActive ? 1 : 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
