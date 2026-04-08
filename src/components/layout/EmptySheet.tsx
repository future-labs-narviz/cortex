import { useState, useRef, useEffect } from "react";
import {
  FileText,
  Search,
  Network,
  CalendarDays,
  Link2,
  Tags,
  Plus,
  Check,
  X,
} from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { invoke } from "@tauri-apps/api/core";
import type { SheetId } from "@/lib/types/layout";
import type { NoteData } from "@/lib/types";

interface EmptySheetProps {
  sheetId: SheetId;
}

export function EmptySheet({ sheetId }: EmptySheetProps) {
  const isVaultOpen = useVaultStore((s) => s.isVaultOpen);
  const files = useVaultStore((s) => s.files);
  const setActiveFile = useVaultStore((s) => s.setActiveFile);
  const openFile = useLayoutStore((s) => s.openFile);
  const setSheetContent = useLayoutStore((s) => s.setSheetContent);
  const [creatingNote, setCreatingNote] = useState(false);
  const [noteName, setNoteName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Get recent files (flat, non-dir, sorted by modified desc)
  const recentFiles = flattenFiles(files)
    .sort((a, b) => b.modified - a.modified)
    .slice(0, 5);

  const handleOpenFile = (path: string) => {
    setActiveFile(path);
    invoke<NoteData>("read_note", { path })
      .then((data) => openFile(sheetId, path, data.content))
      .catch(() => openFile(sheetId, path, ""));
  };

  const handleCreateNote = () => {
    const title = noteName.trim();
    if (!title) return;
    setCreatingNote(false);
    setNoteName("");
    useVaultStore
      .getState()
      .createNote(title)
      .then((path) => {
        setActiveFile(path);
        openFile(sheetId, path, "");
      })
      .catch((err) => {
        console.warn("[Cortex] createNote failed:", err);
      });
  };

  const handleCancelCreate = () => {
    setCreatingNote(false);
    setNoteName("");
  };

  // Auto-focus input when creating
  useEffect(() => {
    if (creatingNote && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creatingNote]);

  if (!isVaultOpen) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: 32,
        paddingTop: 48,
        gap: 24,
      }}
    >
      {/* Logo / branding */}
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
        }}
      >
        Cortex
      </div>

      {/* Inline note creation */}
      {creatingNote ? (
        <div
          style={{
            width: "100%",
            maxWidth: 320,
            display: "flex",
            gap: 6,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={noteName}
            onChange={(e) => setNoteName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateNote();
              if (e.key === "Escape") handleCancelCreate();
            }}
            placeholder="Note name..."
            style={{
              flex: 1,
              height: 36,
              paddingLeft: 12,
              paddingRight: 12,
              fontSize: 13,
              borderRadius: 8,
              border: "1px solid var(--accent)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <button
            onClick={handleCreateNote}
            disabled={!noteName.trim()}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "none",
              cursor: noteName.trim() ? "pointer" : "default",
              background: noteName.trim()
                ? "var(--accent-soft)"
                : "var(--muted)",
              color: noteName.trim()
                ? "var(--accent)"
                : "var(--text-muted)",
              transition: "all 150ms",
            }}
          >
            <Check size={16} />
          </button>
          <button
            onClick={handleCancelCreate}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: "transparent",
              color: "var(--text-muted)",
              transition: "all 150ms",
            }}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        /* Quick access grid */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            width: "100%",
            maxWidth: 320,
          }}
        >
          <QuickAction
            icon={<Plus size={18} />}
            label="New Note"
            onClick={() => setCreatingNote(true)}
          />
          <QuickAction
            icon={<Search size={18} />}
            label="Search"
            onClick={() =>
              setSheetContent(sheetId, { kind: "panel", panel: "search" })
            }
          />
          <QuickAction
            icon={<Network size={18} />}
            label="Graph"
            onClick={() => setSheetContent(sheetId, { kind: "graph" })}
          />
          <QuickAction
            icon={<CalendarDays size={18} />}
            label="Calendar"
            onClick={() =>
              setSheetContent(sheetId, { kind: "panel", panel: "calendar" })
            }
          />
          <QuickAction
            icon={<Link2 size={18} />}
            label="Backlinks"
            onClick={() =>
              setSheetContent(sheetId, { kind: "panel", panel: "backlinks" })
            }
          />
          <QuickAction
            icon={<Tags size={18} />}
            label="Tags"
            onClick={() =>
              setSheetContent(sheetId, { kind: "panel", panel: "tags" })
            }
          />
        </div>
      )}

      {/* Recent files */}
      {recentFiles.length > 0 && (
        <div style={{ width: "100%", maxWidth: 320 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            Recent
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {recentFiles.map((file) => (
              <RecentFileItem
                key={file.path}
                name={file.name}
                onClick={() => handleOpenFile(file.path)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "14px 8px",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        background: hovered ? "var(--muted-hover)" : "var(--muted)",
        color: hovered ? "var(--text-primary)" : "var(--text-secondary)",
        cursor: "pointer",
        transition: "all 150ms",
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function RecentFileItem({
  name,
  onClick,
}: {
  name: string;
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
        padding: "6px 10px",
        borderRadius: "var(--radius-md)",
        border: "none",
        background: hovered ? "var(--muted-hover)" : "transparent",
        color: hovered ? "var(--text-primary)" : "var(--text-secondary)",
        cursor: "pointer",
        transition: "all 150ms",
        fontSize: 13,
        textAlign: "left",
        width: "100%",
      }}
    >
      <FileText
        size={14}
        style={{ flexShrink: 0, color: "var(--text-muted)" }}
      />
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name.replace(/\.md$/, "")}
      </span>
    </button>
  );
}

/** Flatten VaultFile tree into flat file list */
function flattenFiles(
  files: {
    path: string;
    name: string;
    is_dir: boolean;
    modified: number;
    children?: any[];
  }[],
): { path: string; name: string; modified: number }[] {
  const result: { path: string; name: string; modified: number }[] = [];
  for (const f of files) {
    if (f.is_dir && f.children) {
      result.push(...flattenFiles(f.children));
    } else if (!f.is_dir) {
      result.push({ path: f.path, name: f.name, modified: f.modified });
    }
  }
  return result;
}
