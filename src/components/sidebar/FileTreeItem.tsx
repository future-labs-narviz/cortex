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

  const textColor = isActive
    ? 'var(--accent)'
    : isHovered
      ? 'var(--text-primary)'
      : file.is_dir
        ? 'var(--text-secondary)'
        : 'var(--text-primary)';

  const iconColor = isActive
    ? 'var(--accent)'
    : 'var(--text-muted)';

  return (
    <div
      role="button"
      tabIndex={0}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft,
        paddingRight: 8,
        paddingTop: 6,
        paddingBottom: 6,
        borderRadius: 'var(--radius-md)',
        fontSize: 13,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'background 150ms, color 150ms',
        background: isActive
          ? 'var(--accent-soft)'
          : isHovered
            ? 'var(--muted-hover)'
            : 'transparent',
        color: textColor,
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
      }}
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
          size={16}
          style={{
            flexShrink: 0,
            color: 'var(--text-muted)',
            transition: 'transform 150ms',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        />
      ) : (
        <span style={{ width: 14, flexShrink: 0 }} />
      )}

      {/* Icon */}
      {file.is_dir ? (
        isExpanded ? (
          <FolderOpen size={16} style={{ flexShrink: 0, color: 'var(--accent)' }} />
        ) : (
          <FolderClosed size={16} style={{ flexShrink: 0, color: iconColor }} />
        )
      ) : (
        <FileText size={16} style={{ flexShrink: 0, color: iconColor }} />
      )}

      {/* Name */}
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.5,
        }}
      >
        {file.name}
      </span>
    </div>
  );
}
