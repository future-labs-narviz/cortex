import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore, type Pane } from "@/stores/editorStore";
import { useVaultStore } from "@/stores/vaultStore";
import { invoke } from "@tauri-apps/api/core";
import { FileText, FolderOpen } from "lucide-react";
import { Editor } from "./Editor";
import { EditorToolbar } from "./EditorToolbar";
import { TabBar } from "./TabBar";
import type { NoteData } from "@/lib/types";

const MIN_PANE_PX = 200;

export function SplitView() {
  const splitDirection = useEditorStore((s) => s.splitDirection);
  const splitRatio = useEditorStore((s) => s.splitRatio);
  const setSplitRatio = useEditorStore((s) => s.setSplitRatio);
  const panes = useEditorStore((s) => s.panes);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      let ratio: number;

      if (splitDirection === "horizontal") {
        const x = e.clientX - rect.left;
        ratio = x / rect.width;
      } else {
        const y = e.clientY - rect.top;
        ratio = y / rect.height;
      }

      // Enforce minimum pane size
      const containerSize =
        splitDirection === "horizontal" ? rect.width : rect.height;
      const minRatio = MIN_PANE_PX / containerSize;
      const maxRatio = 1 - minRatio;
      ratio = Math.max(minRatio, Math.min(maxRatio, ratio));

      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, splitDirection, setSplitRatio]);

  const handleDoubleClick = useCallback(() => {
    setSplitRatio(0.5);
  }, [setSplitRatio]);

  // Single pane mode
  if (splitDirection === "none") {
    return <EditorPane paneIndex={0} pane={panes[0]} />;
  }

  const isHorizontal = splitDirection === "horizontal";
  const pct1 = `${splitRatio * 100}%`;
  const pct2 = `${(1 - splitRatio) * 100}%`;

  return (
    <div
      ref={containerRef}
      className={`flex flex-1 min-h-0 min-w-0 ${
        isHorizontal ? "flex-row" : "flex-col"
      }`}
    >
      {/* Pane 1 */}
      <div
        style={
          isHorizontal
            ? { width: pct1, minWidth: MIN_PANE_PX }
            : { height: pct1, minHeight: MIN_PANE_PX }
        }
        className="flex min-w-0 min-h-0"
      >
        <EditorPane paneIndex={0} pane={panes[0]} />
      </div>

      {/* Divider */}
      <div
        className={`group flex-shrink-0 relative ${
          isHorizontal
            ? "w-[4px] cursor-col-resize"
            : "h-[4px] cursor-row-resize"
        }`}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className={`absolute transition-all duration-150 ease-out ${
            isDragging
              ? "bg-[var(--accent)]"
              : "bg-[var(--border)] group-hover:bg-[var(--accent)]/70"
          } ${
            isHorizontal
              ? `h-full left-1/2 -translate-x-1/2 top-0 ${isDragging ? "w-[3px]" : "w-[1px] group-hover:w-[3px]"}`
              : `w-full top-1/2 -translate-y-1/2 left-0 ${isDragging ? "h-[3px]" : "h-[1px] group-hover:h-[3px]"}`
          }`}
        />
      </div>

      {/* Pane 2 */}
      <div
        style={
          isHorizontal
            ? { width: pct2, minWidth: MIN_PANE_PX }
            : { height: pct2, minHeight: MIN_PANE_PX }
        }
        className="flex min-w-0 min-h-0"
      >
        <EditorPane paneIndex={1} pane={panes[1]} />
      </div>

      {/* Drag overlay to prevent editor from stealing mouse events */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50"
          style={{
            cursor: isHorizontal ? "col-resize" : "row-resize",
          }}
        />
      )}
    </div>
  );
}

interface EditorPaneProps {
  paneIndex: number;
  pane: Pane | undefined;
}

function EditorPane({ paneIndex, pane }: EditorPaneProps) {
  const isVaultOpen = useVaultStore((s) => s.isVaultOpen);
  const activeFilePath = useVaultStore((s) => s.activeFilePath);
  const setActivePane = useEditorStore((s) => s.setActivePane);
  const openTab = useEditorStore((s) => s.openTab);
  const updateContent = useEditorStore((s) => s.updateContent);
  const markSaved = useEditorStore((s) => s.markSaved);
  const activePaneIndex = useEditorStore((s) => s.activePaneIndex);

  const tabs = pane?.tabs ?? [];
  const activeTabId = pane?.activeTabId ?? null;
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const isActive = activePaneIndex === paneIndex;

  // When this is the active pane and activeFilePath changes, load the note
  useEffect(() => {
    if (!activeFilePath || !isActive) return;

    const existing = tabs.find((t) => t.id === activeFilePath);
    if (existing) {
      useEditorStore.getState().setActiveTab(activeFilePath);
      return;
    }

    invoke<NoteData>("read_note", { path: activeFilePath })
      .then((data) => {
        openTab(activeFilePath, data.content);
      })
      .catch(() => {
        openTab(activeFilePath, "");
      });
  }, [activeFilePath, isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback(
    (content: string) => {
      if (activeTabId) {
        updateContent(activeTabId, content);
      }
    },
    [activeTabId, updateContent],
  );

  const handleSave = useCallback(() => {
    if (activeTab) {
      markSaved(activeTab.id, activeTab.content);
    }
  }, [activeTab, markSaved]);

  const handleFocus = useCallback(() => {
    if (!isActive) {
      setActivePane(paneIndex);
    }
  }, [setActivePane, paneIndex, isActive]);

  return (
    <div
      className={`flex flex-col flex-1 min-w-0 min-h-0 bg-[var(--bg-primary)] ${
        isActive ? "" : "opacity-95"
      }`}
      onMouseDown={handleFocus}
    >
      <TabBar paneIndex={paneIndex} />

      {!isVaultOpen ? (
        <div className="flex flex-1 items-center justify-center min-h-0">
          <EmptyState />
        </div>
      ) : !activeTab ? (
        <div className="flex flex-1 items-center justify-center min-h-0">
          <EmptyEditor />
        </div>
      ) : (
        <>
          <EditorToolbar />
          <Editor
            content={activeTab.content}
            onChange={handleChange}
            onSave={handleSave}
            filePath={activeTab.id}
          />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  const openVault = useVaultStore((s) => s.openVault);
  return (
    <div className="flex flex-col items-center text-center px-8 max-w-md">
      {/* Icon with glow ring */}
      <div className="relative w-24 h-24 mb-8">
        <div
          className="absolute inset-0 rounded-[var(--radius-2xl)] bg-gradient-to-br from-blue-500/15 to-blue-600/5 blur-xl opacity-50"
          style={{ animation: 'glow-pulse 3s ease-in-out infinite' }}
        />
        <div className="relative w-full h-full rounded-[var(--radius-2xl)] bg-gradient-to-br from-blue-500/15 to-blue-600/5 border border-[var(--border)] flex items-center justify-center shadow-[var(--shadow-lg)]">
          <FolderOpen className="w-10 h-10 text-[var(--accent)]" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">
        Open a vault to begin
      </h2>
      <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-8">
        Press{" "}
        <kbd className="px-2 py-1 rounded-[var(--radius-md)] bg-[var(--muted)] border border-[var(--border)] text-xs font-mono text-[var(--text-secondary)]">
          Cmd+O
        </kbd>{" "}
        to open an existing vault or create a new one.
      </p>
      <button
        onClick={() => openVault()}
        className="h-12 px-8 text-base font-medium rounded-[var(--radius-xl)] bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[var(--shadow-md)] border border-[rgba(255,255,255,0.15)] hover:shadow-[var(--shadow-glow)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
      >
        Open Vault
      </button>
    </div>
  );
}

function EmptyEditor() {
  return (
    <div className="flex flex-col items-center text-center px-8 max-w-sm">
      <div className="w-14 h-14 rounded-[var(--radius-xl)] bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center mb-5">
        <FileText className="w-6 h-6 text-[var(--text-muted)]" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">
        No file open
      </h3>
      <p className="text-sm text-[var(--text-muted)] leading-relaxed">
        Select a file from the sidebar to start editing.
      </p>
    </div>
  );
}
