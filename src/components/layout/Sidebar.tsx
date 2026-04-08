import { useState, useCallback, useRef, useEffect } from "react";
import {
  FileText,
  Search,
  Clock,
  Mic,
  Plug,
  FolderOpen,
  ArrowUpRight,
} from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { Tooltip } from "@/components/ui/Tooltip";
import { FileExplorer } from "@/components/sidebar/FileExplorer";
import { SearchPanel } from "@/components/sidebar/SearchPanel";
import { ContextTimeline } from "@/components/capture/ContextTimeline";
import { VoiceNoteCreator } from "@/components/voice/VoiceNoteCreator";
import { IntegrationSettings } from "@/components/settings/IntegrationSettings";
import type { SidebarPanel } from "@/lib/types";

interface SidebarNavItem {
  id: SidebarPanel;
  icon: typeof FileText;
  label: string;
}

const navItems: SidebarNavItem[] = [
  { id: "files", icon: FileText, label: "Files" },
  { id: "search", icon: Search, label: "Search" },
  { id: "timeline", icon: Clock, label: "Timeline" },
  { id: "voice", icon: Mic, label: "Voice" },
  { id: "integrations", icon: Plug, label: "Integrations" },
];

/** Panel display names */
const panelLabels: Record<string, string> = {
  files: "Files",
  search: "Search",
  timeline: "Timeline",
  voice: "Voice",
  integrations: "Integrations",
};

export function Sidebar() {
  const [activePanel, setActivePanel] = useState<SidebarPanel>("files");
  const isVaultOpen = useVaultStore((s) => s.isVaultOpen);
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const [width, setWidth] = useState(280);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startWidth.current = width;
    setIsDragging(true);
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX.current;
      const newWidth = Math.max(200, Math.min(500, startWidth.current + delta));
      setWidth(newWidth);
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="flex h-full flex-shrink-0" style={{ width: sidebarCollapsed ? 0 : width, overflow: 'hidden', transition: 'width 200ms ease' }}>
      {/* Icon rail */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 56, flexShrink: 0, padding: '12px 0', gap: 4, background: 'var(--bg-primary)', borderRight: '1px solid var(--border)' }}>
        {navItems.map(({ id, icon: Icon, label }) => {
          const isActive = activePanel === id;
          return (
            <Tooltip key={id} content={label} side="right">
              <button
                onClick={() => setActivePanel(id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 40, height: 40, padding: 0,
                  borderRadius: 'var(--radius-lg)',
                  border: isActive ? '1px solid var(--accent-soft)' : '1px solid transparent',
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 200ms', outline: 'none',
                }}
                onMouseEnter={(e) => { if (!isActive) { (e.currentTarget).style.background = 'var(--muted)'; (e.currentTarget).style.color = 'var(--text-secondary)'; }}}
                onMouseLeave={(e) => { if (!isActive) { (e.currentTarget).style.background = 'transparent'; (e.currentTarget).style.color = 'var(--text-muted)'; }}}
                aria-label={label}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Panel content */}
      <div className="flex-1 min-w-0 overflow-hidden bg-[var(--bg-secondary)]">
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-[var(--border)]" style={{ height: 44, paddingLeft: 20, paddingRight: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-secondary)', fontFamily: '"JetBrains Mono", monospace' }}>
            {panelLabels[activePanel]}
          </span>
          {/* Pop-out to sheet button — not for "files" panel */}
          {activePanel !== "files" && (
            <Tooltip content="Open in sheet" side="bottom">
              <button
                onClick={() => {
                  const layout = useLayoutStore.getState();
                  const sheet = layout.sheets[layout.activeSheetId];
                  if (activePanel === "graph") {
                    layout.setSheetContent(layout.activeSheetId, { kind: "graph" });
                  } else {
                    layout.setSheetContent(layout.activeSheetId, { kind: "panel", panel: activePanel });
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 6,
                  border: 'none', background: 'transparent',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  transition: 'all 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--muted-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                aria-label="Open in sheet"
              >
                <ArrowUpRight size={14} />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Panel body */}
        <div className="p-4 overflow-y-auto h-[calc(100%-2.75rem)]">
          {activePanel === "files" && (isVaultOpen ? <FileExplorer /> : <NoVaultState />)}
          {activePanel === "search" && (isVaultOpen ? <SearchPanel /> : <NoVaultState />)}
          {activePanel === "timeline" && <ContextTimeline />}
          {activePanel === "voice" && <VoicePanel />}
          {activePanel === "integrations" && <IntegrationSettings />}
        </div>
      </div>

      {/* Drag handle for resizing */}
      <div
        onMouseDown={handleMouseDown}
        className={`w-1 flex-shrink-0 cursor-col-resize transition-colors duration-200 ${
          isDragging ? "bg-[var(--accent)]/70" : "bg-[var(--border)]/40 hover:bg-[var(--accent)]/70"
        }`}
      />
    </div>
  );
}

/** Unified empty state shown when no vault is open — single "Open Vault" button */
function NoVaultState() {
  const openVault = useVaultStore((s) => s.openVault);
  return (
    <div className="flex flex-col items-center justify-center h-full text-center" style={{ padding: '0 24px' }}>
      <FolderOpen style={{ width: 24, height: 24, color: 'var(--text-muted)', marginBottom: 16 }} />
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
        No vault open
      </p>
      <button
        onClick={() => openVault()}
        className="btn-primary text-white border border-[rgba(255,255,255,0.12)] hover:shadow-[var(--shadow-glow)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
        style={{ height: 36, paddingLeft: 24, paddingRight: 24, fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
      >
        Open Vault
      </button>
    </div>
  );
}

function VoicePanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <VoiceNoteCreator />
      <div style={{ borderBottom: '1px solid var(--border)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 16 }}>
        <Mic style={{ width: 20, height: 20, color: 'var(--text-muted)', marginBottom: 12 }} />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 180 }}>
          Record voice notes or dictate text directly into your editor.
        </p>
      </div>
    </div>
  );
}

