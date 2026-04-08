import { useState } from "react";
import {
  ChevronRight,
  FolderClosed,
  FolderOpen,
  FileText,
} from "lucide-react";
import type { VaultFile } from "@/lib/types";

interface FileTreeItemProps {
  file: VaultFile;
  depth: number;
  isActive: boolean;
  isExpanded: boolean;
  onClickFile: (file: VaultFile) => void;
  onToggleFolder: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, file: VaultFile) => void;
}

export function FileTreeItem({
  file,
  depth,
  isActive,
  isExpanded,
  onClickFile,
  onToggleFolder,
  onContextMenu,
}: FileTreeItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (file.is_dir) {
      onToggleFolder(file.path);
    } else {
      onClickFile(file);
    }
  };

  const paddingLeft = 8 + depth * 16;

  return (
    <div
      role="button"
      tabIndex={0}
      className={`flex items-center gap-1 py-[3px] pr-2 rounded-md text-xs cursor-pointer select-none transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 ${
        isActive
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : isHovered
            ? "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
            : "text-[var(--text-secondary)]"
      }`}
      style={{ paddingLeft }}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      onContextMenu={(e) => onContextMenu(e, file)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Expand/collapse arrow for folders */}
      {file.is_dir ? (
        <ChevronRight
          size={14}
          className={`flex-shrink-0 text-[var(--text-muted)] transition-transform duration-150 ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      ) : (
        <span className="w-[14px] flex-shrink-0" />
      )}

      {/* Icon */}
      {file.is_dir ? (
        isExpanded ? (
          <FolderOpen
            size={14}
            className="flex-shrink-0 text-[var(--accent)]"
          />
        ) : (
          <FolderClosed
            size={14}
            className="flex-shrink-0 text-[var(--text-muted)]"
          />
        )
      ) : (
        <FileText
          size={14}
          className="flex-shrink-0 text-[var(--text-muted)]"
        />
      )}

      {/* Name */}
      <span className="truncate">{file.name}</span>
    </div>
  );
}
