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
    <div className="flex flex-col items-center text-center" style={{ maxWidth: 400, padding: '0 32px' }}>
      {/* Icon with glow ring */}
      <div className="relative" style={{ width: 64, height: 64, marginBottom: 32 }}>
        <div
          className="absolute inset-0 glow-blue blur-lg"
          style={{ borderRadius: 'var(--radius-xl)', opacity: 0.4, animation: 'glow-pulse 3s ease-in-out infinite' }}
        />
        <div
          className="relative w-full h-full glow-blue flex items-center justify-center"
          style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}
        >
          <FolderOpen style={{ width: 28, height: 28, color: 'var(--accent)' }} />
        </div>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
        Open a vault to begin
      </h2>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 32, maxWidth: 300 }}>
        Press{" "}
        <kbd style={{ padding: '3px 8px', borderRadius: 'var(--radius-md)', background: 'var(--muted)', border: '1px solid var(--border)', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
          Cmd+O
        </kbd>{" "}
        to open an existing vault or create a new one.
      </p>

      <button
        onClick={() => openVault()}
        className="btn-primary text-white border border-[rgba(255,255,255,0.12)] hover:shadow-[var(--shadow-glow)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
        style={{ height: 40, paddingLeft: 28, paddingRight: 28, fontSize: 14, fontWeight: 500, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
      >
        Open Vault
      </button>
    </div>
  );
}

function EmptyEditor() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 32px', maxWidth: 360 }}>
      <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-xl)', background: 'var(--muted)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <FileText style={{ width: 22, height: 22, color: 'var(--text-muted)' }} />
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
        No file open
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Select a file from the sidebar to start editing.
      </p>
    </div>
  );
}
