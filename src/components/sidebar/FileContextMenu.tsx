import { useEffect, useRef } from "react";
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
    {
      label: "New Folder",
      icon: FolderPlus,
      action: () => onNewFolder(folder),
    },
    { label: "Rename", icon: PencilLine, action: () => onRename(file) },
    { label: "Copy Path", icon: Copy, action: () => onCopyPath(file.path) },
    {
      label: "Delete",
      icon: Trash2,
      action: () => onDelete(file),
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] py-1 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] shadow-lg"
      style={{ left: x, top: y }}
    >
      {items.map(({ label, icon: Icon, action, danger }) => (
        <button
          key={label}
          onClick={() => {
            action();
            onClose();
          }}
          className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 ${
            danger
              ? "text-[var(--red)] hover:bg-[var(--red)]/10"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          }`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}
