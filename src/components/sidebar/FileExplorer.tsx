import { useState, useCallback } from "react";
import { FolderOpen, Plus } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "@/stores/vaultStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { FileTreeItem } from "./FileTreeItem";
import { FileContextMenu } from "./FileContextMenu";
import type { VaultFile, NoteData } from "@/lib/types";

interface ContextMenuState {
  x: number;
  y: number;
  file: VaultFile;
}

export function FileExplorer() {
  const files = useVaultStore((s) => s.files);
  const isVaultOpen = useVaultStore((s) => s.isVaultOpen);
  const activeFilePath = useVaultStore((s) => s.activeFilePath);
  const expandedFolders = useVaultStore((s) => s.expandedFolders);
  const toggleFolder = useVaultStore((s) => s.toggleFolder);
  const setActiveFile = useVaultStore((s) => s.setActiveFile);
  const openVault = useVaultStore((s) => s.openVault);
  const createNote = useVaultStore((s) => s.createNote);
  const createFolder = useVaultStore((s) => s.createFolder);
  const renameNote = useVaultStore((s) => s.renameNote);
  const deleteNote = useVaultStore((s) => s.deleteNote);
  const vaultPath = useVaultStore((s) => s.vaultPath);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(
    null,
  );

  const openNote = useCallback(
    (path: string) => {
      setActiveFile(path);
      const layout = useLayoutStore.getState();
      const sheetId = layout.activeSheetId;
      invoke<NoteData>("read_note", { path })
        .then((data) => {
          // Route type:plan notes to the plan-runner sheet kind instead of
          // the regular file editor. The Rust Frontmatter has typed fields
          // for title/tags/etc and stringifies everything else into `extra`,
          // so the discriminator lives at frontmatter.extra.type.
          const fm = data.frontmatter as
            | { extra?: Record<string, string> }
            | null
            | undefined;
          const noteType = fm?.extra?.type;
          if (noteType === "plan") {
            layout.setSheetContent(sheetId, { kind: "plan-runner", planPath: path });
          } else {
            layout.openFile(sheetId, path, data.content);
          }
        })
        .catch(() => layout.openFile(sheetId, path, ""));
    },
    [setActiveFile],
  );

  const handleClickFile = useCallback(
    (file: VaultFile) => {
      if (!file.is_dir) {
        openNote(file.path);
      }
    },
    [openNote],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: VaultFile) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, file });
    },
    [],
  );

  const handleNewNote = useCallback(
    async (folder: string) => {
      const title = window.prompt("Note name:");
      if (!title) return;
      const path = await createNote(title, folder);
      openNote(path);
    },
    [createNote, openNote],
  );

  const handleNewFolder = useCallback(
    async (parent: string) => {
      const name = window.prompt("Folder name:");
      if (!name) return;
      await createFolder(`${parent}/${name}`);
    },
    [createFolder],
  );

  const handleRename = useCallback(
    async (file: VaultFile) => {
      const newName = window.prompt("New name:", file.name);
      if (!newName || newName === file.name) return;
      const dir = file.path.replace(/\/[^/]+$/, "");
      await renameNote(file.path, `${dir}/${newName}`);
    },
    [renameNote],
  );

  const handleDelete = useCallback(
    async (file: VaultFile) => {
      const confirmed = window.confirm(
        `Delete "${file.name}"? This cannot be undone.`,
      );
      if (!confirmed) return;
      await deleteNote(file.path);
    },
    [deleteNote],
  );

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path).catch(console.error);
  }, []);

  // No vault open state is handled by the Sidebar's unified NoVaultState
  if (!isVaultOpen) return null;

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-full text-center">
        <FolderOpen size={32} className="text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-muted)]">Vault is empty.</p>
        <button
          onClick={() => handleNewNote(vaultPath ?? "")}
          className="flex items-center gap-1.5 h-10 px-6 text-sm font-medium rounded-[var(--radius-lg)] btn-primary text-white shadow-[var(--shadow-md)] border border-[rgba(255,255,255,0.15)] hover:shadow-[var(--shadow-glow)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          <Plus size={12} />
          New Note
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {/* File tree */}
      <FileTree
        files={files}
        depth={0}
        activeFilePath={activeFilePath}
        expandedFolders={expandedFolders}
        onClickFile={handleClickFile}
        onToggleFolder={toggleFolder}
        onContextMenu={handleContextMenu}
      />

      {/* Context menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          onClose={() => setContextMenu(null)}
          onNewNote={handleNewNote}
          onNewFolder={handleNewFolder}
          onRename={handleRename}
          onDelete={handleDelete}
          onCopyPath={handleCopyPath}
        />
      )}
    </div>
  );
}

interface FileTreeProps {
  files: VaultFile[];
  depth: number;
  activeFilePath: string | null;
  expandedFolders: Set<string>;
  onClickFile: (file: VaultFile) => void;
  onToggleFolder: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, file: VaultFile) => void;
}

function FileTree({
  files,
  depth,
  activeFilePath,
  expandedFolders,
  onClickFile,
  onToggleFolder,
  onContextMenu,
}: FileTreeProps) {
  return (
    <>
      {files.map((file) => {
        const isExpanded = expandedFolders.has(file.path);
        return (
          <div key={file.path}>
            <FileTreeItem
              file={file}
              depth={depth}
              isActive={activeFilePath === file.path}
              isExpanded={isExpanded}
              onClickFile={onClickFile}
              onToggleFolder={onToggleFolder}
              onContextMenu={onContextMenu}
            />
            {file.is_dir && isExpanded && file.children && (
              <div
                className="overflow-hidden transition-all duration-150 ease-in-out"
                style={{
                  maxHeight: isExpanded ? "9999px" : "0px",
                  opacity: isExpanded ? 1 : 0,
                }}
              >
                <FileTree
                  files={file.children}
                  depth={depth + 1}
                  activeFilePath={activeFilePath}
                  expandedFolders={expandedFolders}
                  onClickFile={onClickFile}
                  onToggleFolder={onToggleFolder}
                  onContextMenu={onContextMenu}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
