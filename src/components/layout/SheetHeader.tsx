import { useState, useCallback, useRef, useEffect } from "react";
import { FileText, X, Plus, Columns2, Rows2, Home } from "lucide-react";
import { useLayoutStore } from "@/stores/layoutStore";
import { ViewModeControl } from "./ViewModeControl";
import type { SheetId } from "@/lib/types/layout";

/** Label for non-file sheet content types */
const CONTENT_LABELS: Record<string, string> = {
  graph: "Knowledge Graph",
  search: "Search",
  backlinks: "Backlinks",
  tags: "Tags",
  calendar: "Calendar",
  timeline: "Timeline",
  voice: "Voice",
  integrations: "Integrations",
};

interface SheetHeaderProps {
  sheetId: SheetId;
}

export function SheetHeader({ sheetId }: SheetHeaderProps) {
  const sheet = useLayoutStore((s) => s.sheets[sheetId]);
  const activeSheetId = useLayoutStore((s) => s.activeSheetId);
  const setActiveSheet = useLayoutStore((s) => s.setActiveSheet);
  const setActiveTab = useLayoutStore((s) => s.setActiveTab);
  const closeTab = useLayoutStore((s) => s.closeTab);
  const splitSheet = useLayoutStore((s) => s.splitSheet);
  const closeSheet = useLayoutStore((s) => s.closeSheet);
  const setSheetContent = useLayoutStore((s) => s.setSheetContent);
  const root = useLayoutStore((s) => s.root);
  const sheetCount = countLeaves(root);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const tabs = sheet?.tabs ?? [];
  const activeTabId = sheet?.activeTabId ?? null;
  const isFileSheet = sheet?.content.kind === "file";
  const canSplit = sheetCount < 3;
  const hasMultipleSheets = sheetCount > 1;

  // Content label for non-file, non-empty sheets (graph, panel)
  const contentLabel = (() => {
    if (!sheet || sheet.content.kind === "file" || sheet.content.kind === "empty") return null;
    if (sheet.content.kind === "graph") return CONTENT_LABELS.graph;
    if (sheet.content.kind === "panel") return CONTENT_LABELS[sheet.content.panel] ?? sheet.content.panel;
    return null;
  })();

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!activeTabId || !tabsContainerRef.current) return;
    const container = tabsContainerRef.current;
    const activeEl = container.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [activeTabId]);

  const handleClick = useCallback(
    (tabId: string) => {
      if (sheetId !== activeSheetId) setActiveSheet(sheetId);
      setActiveTab(sheetId, tabId);
    },
    [sheetId, activeSheetId, setActiveSheet, setActiveTab],
  );

  const handleClose = useCallback(
    (tabId: string) => {
      if (sheetId !== activeSheetId) setActiveSheet(sheetId);
      closeTab(sheetId, tabId);
    },
    [sheetId, activeSheetId, setActiveSheet, closeTab],
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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 44,
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        paddingLeft: 4,
        paddingRight: 6,
        borderRadius: "12px 12px 0 0",
      }}
    >
      {/* Tabs area (scrollable) — or content label for non-file sheets */}
      <div
        ref={tabsContainerRef}
        style={{
          display: "flex",
          alignItems: "flex-end",
          flex: 1,
          minWidth: 0,
          height: "100%",
          overflowX: "auto",
          overflowY: "hidden",
          gap: 2,
        }}
        className="scrollbar-none"
      >
        {/* For graph/panel sheets: show a label + back-to-home button */}
        {contentLabel && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: "100%",
              paddingLeft: 8,
            }}
          >
            <HeaderIconButton
              icon={<Home size={14} />}
              label="Back to home"
              onClick={() => setSheetContent(sheetId, { kind: "empty" })}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              {contentLabel}
            </span>
          </div>
        )}

        {/* File tabs */}
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            id={tab.id}
            title={tab.title}
            filePath={tab.filePath}
            isDirty={tab.isDirty}
            isActive={tab.id === activeTabId}
            onClick={() => handleClick(tab.id)}
            onClose={() => handleClose(tab.id)}
            onMouseDown={(e) => handleMouseDown(e, tab.id)}
          />
        ))}
      </div>

      {/* Right-side controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginLeft: 8,
          flexShrink: 0,
        }}
      >
        {/* View mode control — only for file sheets with open tabs */}
        {isFileSheet && tabs.length > 0 && (
          <ViewModeControl sheetId={sheetId} />
        )}

        {/* Split menu — "+" button with dropdown */}
        {canSplit && (
          <SplitMenu
            onSplitRight={() => splitSheet(sheetId, "horizontal")}
            onSplitDown={() => splitSheet(sheetId, "vertical")}
          />
        )}

        {/* Close sheet — only visible when multiple sheets */}
        {hasMultipleSheets && (
          <HeaderIconButton
            icon={<X size={14} />}
            label="Close pane"
            onClick={() => closeSheet(sheetId)}
          />
        )}
      </div>
    </div>
  );
}

// ── Split Menu ────────────────────────────────────────────

function SplitMenu({
  onSplitRight,
  onSplitDown,
}: {
  onSplitRight: () => void;
  onSplitDown: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <HeaderIconButton
        icon={<Plus size={14} />}
        label="Split pane"
        isActive={open}
        onClick={() => setOpen((v) => !v)}
      />

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            width: 160,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "var(--shadow-md)",
            padding: 4,
            zIndex: 100,
          }}
        >
          <SplitMenuItem
            icon={<Columns2 size={14} />}
            label="Split Right"
            shortcut="Cmd+\"
            onClick={() => {
              onSplitRight();
              setOpen(false);
            }}
          />
          <SplitMenuItem
            icon={<Rows2 size={14} />}
            label="Split Down"
            shortcut="Cmd+Shift+\"
            onClick={() => {
              onSplitDown();
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function SplitMenuItem({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "6px 8px",
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
        background: hovered ? "var(--muted-hover)" : "transparent",
        color: hovered ? "var(--text-primary)" : "var(--text-secondary)",
        fontSize: 12,
        transition: "all 120ms",
        textAlign: "left",
      }}
    >
      <span style={{ flexShrink: 0, display: "flex" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          fontFamily: '"JetBrains Mono", monospace',
          flexShrink: 0,
        }}
      >
        {shortcut}
      </span>
    </button>
  );
}

// ── Shared header icon button ─────────────────────────────

function HeaderIconButton({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
        transition: "all 150ms",
        background:
          isActive
            ? "var(--muted-strong)"
            : hovered
              ? "var(--muted-hover)"
              : "transparent",
        color:
          isActive
            ? "var(--text-primary)"
            : hovered
              ? "var(--text-primary)"
              : "var(--text-muted)",
      }}
    >
      {icon}
    </button>
  );
}

// ── Tab component ─────────────────────────────────────────

function Tab({
  id,
  title,
  filePath,
  isDirty,
  isActive,
  onClick,
  onClose,
  onMouseDown,
}: {
  id: string;
  title: string;
  filePath: string;
  isDirty: boolean;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);

  // Extract folder path for breadcrumb
  const folder = filePath.includes("/")
    ? filePath.replace(/\/[^/]+$/, "")
    : "";

  return (
    <div
      data-tab-id={id}
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        paddingLeft: 10,
        paddingRight: 6,
        height: 36,
        maxWidth: 200,
        minWidth: 0,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        cursor: "pointer",
        userSelect: "none",
        transition: "background 150ms",
        position: "relative",
        background: isActive
          ? "var(--bg-primary)"
          : hovered
            ? "var(--bg-tertiary)"
            : "transparent",
        color: isActive ? "var(--text-primary)" : "var(--text-muted)",
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
      {isActive && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 8,
            right: 8,
            height: 2,
            borderRadius: 1,
            background: "var(--accent)",
          }}
        />
      )}

      <FileText
        size={13}
        style={{
          flexShrink: 0,
          color: isActive ? "var(--text-secondary)" : "var(--text-muted)",
        }}
      />

      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: isActive ? 500 : 400,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: folder ? 1.2 : 1.5,
          }}
        >
          {title}
        </div>
        {folder && isActive && (
          <div
            style={{
              fontSize: 9,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: 1.2,
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            {folder}
          </div>
        )}
      </div>

      {isDirty && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--accent)",
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: 4,
          border: "none",
          cursor: "pointer",
          flexShrink: 0,
          transition: "all 150ms",
          background: closeHovered ? "var(--muted-strong)" : "transparent",
          color: closeHovered ? "var(--text-primary)" : "var(--text-muted)",
          opacity: hovered || isActive ? 1 : 0,
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────

function countLeaves(node: import("@/lib/types/layout").LayoutNode): number {
  if (node.type === "sheet") return 1;
  return countLeaves(node.children[0]) + countLeaves(node.children[1]);
}
