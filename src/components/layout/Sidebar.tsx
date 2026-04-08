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

  return (
    <div className="flex h-full w-full">
      {/* Icon rail */}
      <div className="flex flex-col items-center w-[52px] flex-shrink-0 py-4 gap-1 bg-[var(--bg-primary)] border-r border-[var(--border)]">
        <DailyNoteButton />
        <div className="w-6 border-b border-[var(--border)] my-2" />
        {navItems.map(({ id, icon: Icon, label }) => {
          const isActive = activePanel === id;
          return (
            <Tooltip key={id} content={label} side="right">
              <button
                onClick={() => setActivePanel(id)}
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 ${
                  isActive
                    ? "bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                }`}
                aria-label={label}
              >
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Panel content */}
      <div className="flex-1 min-w-0 overflow-hidden bg-[var(--bg-secondary)]">
        {/* Panel header */}
        <div className="flex items-center h-12 px-4 border-b border-[var(--border)]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {activePanel}
          </span>
        </div>

        {/* Panel body */}
        <div className="px-4 py-4 overflow-y-auto h-[calc(100%-3rem)]">
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

/** Reusable empty state for sidebar panels */
function SidebarEmptyState({
  icon: Icon,
  title,
  description,
  showVaultButton = true,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  showVaultButton?: boolean;
}) {
  const openVault = useVaultStore((s) => s.openVault);

  return (
    <div className="flex flex-col items-center text-center pt-16 px-2">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border)] mb-5 shadow-sm">
        <Icon size={28} className="text-[var(--text-muted)]" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
        {title}
      </h3>
      <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-6 max-w-[200px]">
        {description}
      </p>
      {showVaultButton && (
        <button
          onClick={() => openVault()}
          className="px-6 py-3 text-sm font-medium rounded-xl bg-[var(--accent)] text-white shadow-sm hover:shadow-md hover:brightness-110 active:scale-[0.98] transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
        >
          Open a Vault
        </button>
      )}
    </div>
  );
}

function GraphPanel() {
  const isVaultOpen = useVaultStore((s) => s.isVaultOpen);

  if (!isVaultOpen) {
    return (
      <SidebarEmptyState
        icon={GitFork}
        title="Knowledge Graph"
        description="Open a vault to explore connections between your notes."
      />
    );
  }

  return (
    <div className="w-full h-full -m-5" style={{ minHeight: 200 }}>
      <GraphView compact />
    </div>
  );
}

function VoicePanel() {
  return (
    <div className="flex flex-col gap-5">
      <VoiceNoteCreator />
      <div className="w-full border-b border-[var(--border)]" />
      <SidebarEmptyState
        icon={Mic}
        title="Voice Notes"
        description="Record voice notes or dictate text directly into your editor."
        showVaultButton={false}
      />
    </div>
  );
}

function TagsPanel() {
  const isVaultOpen = useVaultStore((s) => s.isVaultOpen);

  return (
    <SidebarEmptyState
      icon={Tags}
      title="Tags"
      description={
        isVaultOpen
          ? "No tags found in your vault yet."
          : "Open a vault to browse tags."
      }
      showVaultButton={!isVaultOpen}
    />
  );
}
