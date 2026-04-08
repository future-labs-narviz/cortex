import { useEffect, useRef, useState } from "react";
import {
  FilePlus,
  FolderPlus,
  PencilLine,
  Trash2,
  Copy,
} from "lucide-react";
import type { VaultFile } from "@/lib/types";

interface FileContextMenuProps {
  x: number;
  y: number;
  file: VaultFile;
  onClose: () => void;
  onNewNote: (folder: string) => void;
  onNewFolder: (parent: string) => void;
  onRename: (file: VaultFile) => void;
  onDelete: (file: VaultFile) => void;
  onCopyPath: (path: string) => void;
}

interface MenuItem {
  label: string;
  icon: typeof FilePlus;
  action: () => void;
  danger?: boolean;
}

function ContextMenuItem({
  label,
  icon: Icon,
  action,
  danger,
  onClose,
}: MenuItem & { onClose: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      role="menuitem"
      onClick={() => {
        action();
        onClose();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: 'calc(100% - 8px)',
        marginLeft: 4,
        marginRight: 4,
        paddingLeft: 12,
        paddingRight: 12,
        height: 32,
        fontSize: 13,
        textAlign: 'left',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        border: 'none',
        transition: 'background 150ms, color 150ms',
        color: danger
          ? 'var(--red)'
          : hovered
            ? 'var(--text-primary)'
            : 'var(--text-secondary)',
        background: hovered
          ? danger
            ? 'rgba(239, 68, 68, 0.1)'
            : 'var(--muted-hover)'
          : 'transparent',
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

export function FileContextMenu({
  x,
  y,
  file,
  onClose,
  onNewNote,
  onNewFolder,
  onRename,
  onDelete,
  onCopyPath,
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const folder = file.is_dir ? file.path : file.path.replace(/\/[^/]+$/, "");

  const items: MenuItem[] = [
    { label: "New Note Here", icon: FilePlus, action: () => onNewNote(folder) },
    { label: "New Folder", icon: FolderPlus, action: () => onNewFolder(folder) },
    { label: "Rename", icon: PencilLine, action: () => onRename(file) },
    { label: "Copy Path", icon: Copy, action: () => onCopyPath(file.path) },
    { label: "Delete", icon: Trash2, action: () => onDelete(file), danger: true },
  ];

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        zIndex: 50,
        left: x,
        top: y,
        minWidth: 180,
        paddingTop: 4,
        paddingBottom: 4,
        borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {items.map((item) => (
        <ContextMenuItem key={item.label} {...item} onClose={onClose} />
      ))}
    </div>
  );
}
