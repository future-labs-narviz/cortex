import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
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
  FolderOpen,
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
        <DailyNoteButton />
        <div style={{ height: 1, background: 'var(--border)', margin: '6px 8px', alignSelf: 'stretch' }} />
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
        <div className="flex items-center justify-between border-b border-[var(--border)]" style={{ height: 44, paddingLeft: 20, paddingRight: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--text-secondary)', fontFamily: '"JetBrains Mono", monospace' }}>
            {panelLabels[activePanel]}
          </span>
        </div>

        {/* Panel body */}
        <div className="p-4 overflow-y-auto h-[calc(100%-2.75rem)]">
          {activePanel === "files" && (isVaultOpen ? <FileExplorer /> : <NoVaultState />)}
          {activePanel === "search" && (isVaultOpen ? <SearchPanel /> : <NoVaultState />)}
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

/** Reusable empty state for sidebar panels — with glow ring */
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 24px', textAlign: 'center' }}>
      {/* Icon with glow ring */}
      <div style={{ position: 'relative', width: 48, height: 48, marginBottom: 20 }}>
        <div
          className={`absolute inset-0 ${gradient} blur-lg`}
          style={{ borderRadius: 'var(--radius-xl)', opacity: 0.3, animation: "glow-pulse 3s ease-in-out infinite" }}
        />
        <div
          className={`relative ${gradient} flex items-center justify-center`}
          style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div style={{ color: accentColor }}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        {title}
      </h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 200 }}>
        {description}
      </p>
      {onAction && actionLabel && (
        <button
          onClick={onAction}
          className="btn-primary text-white border border-[rgba(255,255,255,0.12)] hover:shadow-[var(--shadow-glow)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
          style={{ marginTop: 24, height: 36, paddingLeft: 24, paddingRight: 24, fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {actionLabel}
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
        gradient="glow-blue"
        accentColor="var(--accent)"
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

function TagsPanel() {
  const isVaultOpen = useVaultStore((s) => s.isVaultOpen);
  const setActiveFile = useVaultStore((s) => s.setActiveFile);
  const [tags, setTags] = useState<{ name: string; count: number }[]>([]);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [tagNotes, setTagNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isVaultOpen) return;
    invoke<{ name: string; count: number }[]>("get_all_tags")
      .then(setTags)
      .catch(() => setTags([]));
  }, [isVaultOpen]);

  const handleTagClick = useCallback(async (tagName: string) => {
    if (expandedTag === tagName) {
      setExpandedTag(null);
      setTagNotes([]);
      return;
    }
    setExpandedTag(tagName);
    setLoading(true);
    try {
      const notes = await invoke<string[]>("get_notes_by_tag", { tag: tagName });
      setTagNotes(notes);
    } catch {
      setTagNotes([]);
    }
    setLoading(false);
  }, [expandedTag]);

  if (!isVaultOpen) {
    return (
      <SidebarEmptyState
        icon={Tags}
        title="Tags"
        description="Open a vault to browse tags."
        gradient="glow-blue"
        accentColor="var(--accent)"
      />
    );
  }

  if (tags.length === 0) {
    return (
      <SidebarEmptyState
        icon={Tags}
        title="No Tags"
        description="No tags found in your vault yet."
        gradient="glow-blue"
        accentColor="var(--accent)"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {tags.map((tag) => (
        <div key={tag.name}>
          <button
            onClick={() => handleTagClick(tag.name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '6px 8px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: expandedTag === tag.name ? 'var(--accent-soft)' : 'transparent',
              color: expandedTag === tag.name ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              transition: 'background 150ms',
              textAlign: 'left',
            }}
          >
            <span>#{tag.name}</span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              {tag.count}
            </span>
          </button>
          {expandedTag === tag.name && (
            <div style={{ paddingLeft: 16, paddingTop: 4, paddingBottom: 4 }}>
              {loading ? (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Loading...</span>
              ) : (
                tagNotes.map((notePath) => (
                  <button
                    key={notePath}
                    onClick={() => setActiveFile(notePath)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: 12,
                      textAlign: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      transition: 'color 150ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    {notePath.replace(/\.md$/, '').split('/').pop()}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
