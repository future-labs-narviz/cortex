import { useState } from "react";
import {
  FileText,
  Search,
  GitFork,
  Tags,
  Link2,
  CalendarDays,
  Clock,
  Mic,
  Plug,
} from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useVaultStore } from "@/stores/vaultStore";
import { Tooltip } from "@/components/ui/Tooltip";
import { FileExplorer } from "@/components/sidebar/FileExplorer";
import { SearchPanel } from "@/components/sidebar/SearchPanel";
import { BacklinksPanel } from "@/components/sidebar/BacklinksPanel";
import { GraphView } from "@/components/graph/GraphView";
import { DailyNoteButton } from "@/components/daily-notes/DailyNoteButton";
import { Calendar } from "@/components/daily-notes/Calendar";
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
  { id: "backlinks", icon: Link2, label: "Backlinks" },
  { id: "graph", icon: GitFork, label: "Graph" },
  { id: "tags", icon: Tags, label: "Tags" },
  { id: "calendar", icon: CalendarDays, label: "Calendar" },
  { id: "timeline", icon: Clock, label: "Timeline" },
  { id: "voice", icon: Mic, label: "Voice" },
  { id: "integrations", icon: Plug, label: "Integrations" },
];

export function Sidebar() {
  const [activePanel, setActivePanel] = useState<SidebarPanel>("files");
  const sidebarWidth = useSettingsStore((s) => s.sidebarWidth);
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);

  return (
    <div
      className="flex h-full transition-all duration-200 ease-in-out"
      style={{ width: sidebarCollapsed ? 0 : sidebarWidth, minWidth: 0 }}
    >
      {/* Icon rail */}
      <div
        className="flex flex-col items-center w-[44px] flex-shrink-0 py-2 gap-0.5 bg-[var(--bg-primary)] border-r border-[var(--border)]"
        style={{
          opacity: sidebarCollapsed ? 0 : 1,
          pointerEvents: sidebarCollapsed ? "none" : "auto",
          transition: "opacity 150ms ease",
        }}
      >
        <DailyNoteButton />
        <div className="w-5 border-b border-[var(--border)] my-1" />
        {navItems.map(({ id, icon: Icon, label }) => {
          const isActive = activePanel === id;
          return (
            <Tooltip key={id} content={label} side="right">
              <button
                onClick={() => setActivePanel(id)}
                className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 ${
                  isActive
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                }`}
                aria-label={label}
              >
                <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Panel content */}
      <div
        className="flex-1 min-w-0 overflow-hidden bg-[var(--bg-secondary)] border-r border-[var(--border)]"
        style={{
          opacity: sidebarCollapsed ? 0 : 1,
          transition: "opacity 150ms ease",
        }}
      >
        {/* Panel header */}
        <div className="flex items-center h-8 px-3 border-b border-[var(--border)]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {activePanel}
          </span>
        </div>

        {/* Panel body */}
        <div className="p-3 overflow-y-auto h-[calc(100%-2rem)]">
          {activePanel === "files" && <FileExplorer />}
          {activePanel === "search" && <SearchPanel />}
          {activePanel === "backlinks" && <BacklinksPanel />}
          {activePanel === "graph" && <GraphPanel />}
          {activePanel === "tags" && <TagsPanel />}
          {activePanel === "calendar" && <Calendar />}
          {activePanel === "timeline" && <ContextTimeline />}
          {activePanel === "voice" && <VoicePanel />}
          {activePanel === "integrations" && <IntegrationSettings />}
        </div>
      </div>
    </div>
  );
}

// SearchPanel is now imported from @/components/sidebar/SearchPanel

function GraphPanel() {
  const isVaultOpen = useVaultStore((s) => s.isVaultOpen);
  const openVault = useVaultStore((s) => s.openVault);

  if (!isVaultOpen) {
    return (
      <div className="flex flex-col items-center gap-3 pt-8 text-center">
        <GitFork size={32} className="text-[var(--text-muted)]" />
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          No graph to display.
          <br />
          Open a vault to explore connections.
        </p>
        <button
          onClick={() => openVault()}
          className="px-3 py-1.5 text-xs rounded-md bg-[var(--accent)] text-white hover:opacity-90 transition-opacity duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
        >
          Open a vault
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full -m-3" style={{ minHeight: 200 }}>
      <GraphView compact />
    </div>
  );
}

function VoicePanel() {
  return (
    <div className="flex flex-col gap-3">
      <VoiceNoteCreator />
      <div className="w-full border-b border-[var(--border)] my-1" />
      <div className="flex flex-col items-center gap-3 pt-4 text-center">
        <Mic size={24} className="text-[var(--text-muted)]" />
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Record voice notes or dictate text
          <br />
          directly into your editor.
        </p>
      </div>
    </div>
  );
}

function TagsPanel() {
  const isVaultOpen = useVaultStore((s) => s.isVaultOpen);
  const openVault = useVaultStore((s) => s.openVault);

  return (
    <div className="flex flex-col items-center gap-3 pt-8 text-center">
      <Tags size={32} className="text-[var(--text-muted)]" />
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        No tags found.
        <br />
        Open a vault to see tags.
      </p>
      {!isVaultOpen && (
        <button
          onClick={() => openVault()}
          className="px-3 py-1.5 text-xs rounded-md bg-[var(--accent)] text-white hover:opacity-90 transition-opacity duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
        >
          Open a vault
        </button>
      )}
    </div>
  );
}
