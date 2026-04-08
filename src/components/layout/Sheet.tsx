import { useCallback, useEffect } from "react";
import { FolderOpen } from "lucide-react";
import { useLayoutStore } from "@/stores/layoutStore";
import { useVaultStore } from "@/stores/vaultStore";
import { setActiveEditorSheet } from "@/lib/editorApi";
import { invoke } from "@tauri-apps/api/core";
import { Editor } from "@/components/editor/Editor";
import { MarkdownPreview } from "@/components/editor/MarkdownPreview";
import { EditorErrorBoundary } from "@/components/editor/EditorErrorBoundary";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { GraphView } from "@/components/graph/GraphView";
import { SearchPanel } from "@/components/sidebar/SearchPanel";
import { BacklinksPanel } from "@/components/sidebar/BacklinksPanel";
import { TagsPanel } from "@/components/sidebar/TagsPanel";
import { Calendar } from "@/components/daily-notes/Calendar";
import { ContextTimeline } from "@/components/capture/ContextTimeline";
import { VoiceNoteCreator } from "@/components/voice/VoiceNoteCreator";
import { IntegrationSettings } from "@/components/settings/IntegrationSettings";
import { SheetHeader } from "./SheetHeader";
import { EmptySheet } from "./EmptySheet";
import type { SheetId } from "@/lib/types/layout";
import type { NoteData, SidebarPanel } from "@/lib/types";

interface SheetProps {
  sheetId: SheetId;
}

export function Sheet({ sheetId }: SheetProps) {
  const sheet = useLayoutStore((s) => s.sheets[sheetId]);
  const activeSheetId = useLayoutStore((s) => s.activeSheetId);
  const setActiveSheet = useLayoutStore((s) => s.setActiveSheet);
  const isActive = sheetId === activeSheetId;

  const handleFocus = useCallback(() => {
    if (!isActive) {
      setActiveSheet(sheetId);
    }
    setActiveEditorSheet(sheetId);
  }, [setActiveSheet, sheetId, isActive]);

  if (!sheet) return null;

  return (
    <div
      className={`flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden ${isActive ? "" : "opacity-95"}`}
      style={{
        background: "var(--bg-primary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--sheet-radius, 12px)",
        boxShadow: "var(--sheet-shadow, 0 2px 8px rgba(0,0,0,0.15))",
      }}
      onMouseDown={handleFocus}
    >
      <SheetHeader sheetId={sheetId} />
      <SheetContent sheetId={sheetId} />
    </div>
  );
}

function SheetContent({ sheetId }: { sheetId: SheetId }) {
  const sheet = useLayoutStore((s) => s.sheets[sheetId]);
  const isVaultOpen = useVaultStore((s) => s.isVaultOpen);
  const activeFilePath = useVaultStore((s) => s.activeFilePath);
  const activeSheetId = useLayoutStore((s) => s.activeSheetId);
  const openFile = useLayoutStore((s) => s.openFile);

  // When sidebar file click happens and this is the active sheet in "empty" mode,
  // transition to file mode and load the note
  useEffect(() => {
    if (!activeFilePath || sheetId !== activeSheetId) return;
    if (sheet?.content.kind !== "empty") return;

    invoke<NoteData>("read_note", { path: activeFilePath })
      .then((data) => openFile(sheetId, activeFilePath, data.content))
      .catch(() => openFile(sheetId, activeFilePath, ""));
  }, [activeFilePath, sheetId, activeSheetId, sheet?.content.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sheet) return null;

  if (!isVaultOpen) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-0">
        <NoVaultState />
      </div>
    );
  }

  switch (sheet.content.kind) {
    case "empty":
      return <EmptySheet sheetId={sheetId} />;
    case "graph":
      return (
        <div className="flex-1 min-w-0 min-h-0 relative">
          <EditorErrorBoundary filePath="graph">
            <GraphView />
          </EditorErrorBoundary>
        </div>
      );
    case "file":
      return <FileSheetContent sheetId={sheetId} />;
    case "panel":
      return (
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <PanelContent panel={sheet.content.panel} />
        </div>
      );
    default:
      return null;
  }
}

function FileSheetContent({ sheetId }: { sheetId: SheetId }) {
  const sheet = useLayoutStore((s) => s.sheets[sheetId]);
  const activeFilePath = useVaultStore((s) => s.activeFilePath);
  const activeSheetId = useLayoutStore((s) => s.activeSheetId);
  const openFile = useLayoutStore((s) => s.openFile);
  const updateContent = useLayoutStore((s) => s.updateContent);
  const markSaved = useLayoutStore((s) => s.markSaved);
  const setActiveTab = useLayoutStore((s) => s.setActiveTab);

  const isActive = sheetId === activeSheetId;
  const tabs = sheet?.tabs ?? [];
  const activeTabId = sheet?.activeTabId ?? null;
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  // When this is the active sheet and activeFilePath changes, load the note
  useEffect(() => {
    if (!activeFilePath || !isActive) return;

    const existing = tabs.find((t) => t.id === activeFilePath);
    if (existing) {
      setActiveTab(sheetId, activeFilePath);
      return;
    }

    invoke<NoteData>("read_note", { path: activeFilePath })
      .then((data) => {
        openFile(sheetId, activeFilePath, data.content);
      })
      .catch(() => {
        openFile(sheetId, activeFilePath, "");
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

  if (!activeTab) {
    return <EmptySheet sheetId={sheetId} />;
  }

  const viewMode =
    sheet?.content.kind === "file" ? sheet.content.viewMode : "edit";

  if (viewMode === "preview") {
    return (
      <EditorErrorBoundary filePath={activeTab.id}>
        <MarkdownPreview content={activeTab.content} filePath={activeTab.id} />
      </EditorErrorBoundary>
    );
  }

  if (viewMode === "split") {
    return (
      <div className="flex flex-1 min-h-0 min-w-0 flex-row">
        <div className="flex flex-1 flex-col min-w-0 min-h-0">
          <EditorToolbar />
          <EditorErrorBoundary filePath={activeTab.id}>
            <Editor
              content={activeTab.content}
              onChange={handleChange}
              onSave={handleSave}
              filePath={activeTab.id}
              sheetId={sheetId}
            />
          </EditorErrorBoundary>
        </div>
        <div
          style={{
            width: 1,
            background: "var(--border)",
            flexShrink: 0,
          }}
        />
        <div className="flex flex-1 min-w-0 min-h-0">
          <EditorErrorBoundary filePath={activeTab.id}>
            <MarkdownPreview
              content={activeTab.content}
              filePath={activeTab.id}
            />
          </EditorErrorBoundary>
        </div>
      </div>
    );
  }

  // Default: edit mode
  return (
    <>
      <EditorToolbar />
      <EditorErrorBoundary filePath={activeTab.id}>
        <Editor
          content={activeTab.content}
          onChange={handleChange}
          onSave={handleSave}
          filePath={activeTab.id}
          sheetId={sheetId}
        />
      </EditorErrorBoundary>
    </>
  );
}

function PanelContent({ panel }: { panel: SidebarPanel }) {
  switch (panel) {
    case "search":
      return <SearchPanel />;
    case "backlinks":
      return <BacklinksPanel />;
    case "tags":
      return <TagsPanel />;
    case "calendar":
      return <Calendar />;
    case "timeline":
      return <ContextTimeline />;
    case "voice":
      return <VoiceNoteCreator />;
    case "integrations":
      return <IntegrationSettings />;
    default:
      return null;
  }
}

function NoVaultState() {
  const openVault = useVaultStore((s) => s.openVault);
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{ maxWidth: 400, padding: "0 32px" }}
    >
      <div
        className="relative"
        style={{ width: 64, height: 64, marginBottom: 32 }}
      >
        <div
          className="absolute inset-0 glow-blue blur-lg"
          style={{
            borderRadius: "var(--radius-xl)",
            opacity: 0.4,
            animation: "glow-pulse 3s ease-in-out infinite",
          }}
        />
        <div
          className="relative w-full h-full glow-blue flex items-center justify-center"
          style={{
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <FolderOpen
            style={{ width: 28, height: 28, color: "var(--accent)" }}
          />
        </div>
      </div>

      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: 12,
        }}
      >
        Open a vault to begin
      </h2>

      <p
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          lineHeight: 1.7,
          marginBottom: 32,
          maxWidth: 300,
        }}
      >
        Press{" "}
        <kbd
          style={{
            padding: "3px 8px",
            borderRadius: "var(--radius-md)",
            background: "var(--muted)",
            border: "1px solid var(--border)",
            fontSize: 12,
            fontFamily: "monospace",
            color: "var(--text-secondary)",
          }}
        >
          Cmd+O
        </kbd>{" "}
        to open an existing vault or create a new one.
      </p>

      <button
        onClick={() => openVault()}
        className="btn-primary text-white border border-[rgba(255,255,255,0.12)] hover:shadow-[var(--shadow-glow)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
        style={{
          height: 40,
          paddingLeft: 28,
          paddingRight: 28,
          fontSize: 14,
          fontWeight: 500,
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        Open Vault
      </button>
    </div>
  );
}

