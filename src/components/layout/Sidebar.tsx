import { useState, useCallback, useRef, useEffect } from "react";
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

/** Panel display names */
const panelLabels: Record<SidebarPanel, string> = {
  files: "Files",
  search: "Search",
  backlinks: "Backlinks",
  graph: "Graph",
  tags: "Tags",
  calendar: "Calendar",
  timeline: "Timeline",
  voice: "Voice",
  integrations: "Integrations",
};

export function Sidebar() {
  const [activePanel, setActivePanel] = useState<SidebarPanel>("files");
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
    <div className="flex h-full flex-shrink-0" style={{ width }}>
      {/* Icon rail */}
      <div className="flex flex-col items-center w-14 flex-shrink-0 py-4 gap-1 bg-[var(--bg-primary)] border-r border-[var(--border)]">
        <DailyNoteButton />
        <div className="h-px bg-[var(--border)] mx-2 my-1.5" />
        {navItems.map(({ id, icon: Icon, label }) => {
          const isActive = activePanel === id;
          return (
            <Tooltip key={id} content={label} side="right">
              <button
                onClick={() => setActivePanel(id)}
                className={`relative flex items-center justify-center h-12 w-12 p-0 m-1 rounded-[var(--radius-lg)] transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 ${
                  isActive
                    ? "bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 text-[var(--accent)] shadow-sm border border-[var(--accent)]/20"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--muted)] border border-transparent"
                }`}
                aria-label={label}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
                {isActive && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--accent)]" />
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Panel content */}
      <div className="flex-1 min-w-0 overflow-hidden bg-[var(--bg-secondary)]">
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {panelLabels[activePanel]}
          </span>
        </div>

        {/* Panel body */}
        <div className="p-3 overflow-y-auto h-[calc(100%-2.625rem)]">
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

/** Reusable empty state for sidebar panels — FutureLabs-inspired with glow ring */
function SidebarEmptyState({
  icon: Icon,
  title,
  description,
  gradient,
  accentColor,
  onAction,
  actionLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  gradient: string;
  accentColor: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16">
      {/* Icon with glow ring */}
      <div className="relative w-20 h-20 mb-6">
        <div
          className={`absolute inset-0 rounded-[var(--radius-2xl)] bg-gradient-to-br ${gradient} blur-xl opacity-40`}
          style={{ animation: "glow-pulse 3s ease-in-out infinite" }}
        />
        <div
          className={`relative w-full h-full rounded-[var(--radius-2xl)] bg-gradient-to-br ${gradient} border border-[var(--border)] flex items-center justify-center shadow-[var(--shadow-md)]`}
        >
          <Icon className={`w-8 h-8 ${accentColor}`} />
        </div>
      </div>
      <div className="text-center space-y-2 max-w-[200px]">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          {title}
        </h3>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          {description}
        </p>
      </div>
      {onAction && actionLabel && (
        <button
          onClick={onAction}
          className="mt-6 inline-flex items-center justify-center h-10 px-5 text-sm font-medium rounded-[var(--radius-lg)] bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[var(--shadow-md)] border border-[rgba(255,255,255,0.15)] hover:shadow-[var(--shadow-glow)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function GraphPanel() {
  const isVaultOpen = useVaultStore((s) => s.isVaultOpen);
  const openVault = useVaultStore((s) => s.openVault);

  if (!isVaultOpen) {
    return (
      <SidebarEmptyState
        icon={GitFork}
        title="Knowledge Graph"
        description="Open a vault to explore connections between your notes."
        gradient="from-cyan-500/10 to-cyan-600/5"
        accentColor="text-[var(--cyan)]"
        onAction={() => openVault()}
        actionLabel="Open a Vault"
      />
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
    <div className="flex flex-col gap-5">
      <VoiceNoteCreator />
      <div className="w-full border-b border-[var(--border)]" />
      <SidebarEmptyState
        icon={Mic}
        title="Voice Notes"
        description="Record voice notes or dictate text directly into your editor."
        gradient="from-amber-500/10 to-amber-600/5"
        accentColor="text-[var(--yellow)]"
      />
    </div>
  );
}

function TagsPanel() {
  const isVaultOpen = useVaultStore((s) => s.isVaultOpen);
  const openVault = useVaultStore((s) => s.openVault);

  return (
    <SidebarEmptyState
      icon={Tags}
      title="Tags"
      description={
        isVaultOpen
          ? "No tags found in your vault yet."
          : "Open a vault to browse tags."
      }
      gradient="from-green-500/10 to-green-600/5"
      accentColor="text-[var(--green)]"
      onAction={isVaultOpen ? undefined : () => openVault()}
      actionLabel={isVaultOpen ? undefined : "Open a Vault"}
    />
  );
}
