import { useState, useCallback } from "react";
import { FolderOpen, Plus } from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { FileTreeItem } from "./FileTreeItem";
import { FileContextMenu } from "./FileContextMenu";
import type { VaultFile } from "@/lib/types";

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
  const _openTab = useEditorStore((s) => s.openTab);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(
    null,
  );

  const handleClickFile = useCallback(
    (file: VaultFile) => {
      if (!file.is_dir) {
        setActiveFile(file.path);
        // Content will be loaded by AppShell's activeFilePath effect
      }
    },
    [setActiveFile],
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
      setActiveFile(path);
      _openTab(path, "");
    },
    [createNote, setActiveFile, _openTab],
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

  if (!isVaultOpen) {
    return (
      <div className="flex flex-col items-center gap-3 pt-8 text-center">
        <FolderOpen size={32} className="text-[var(--text-muted)]" />
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          No vault open.
        </p>
        <button
          onClick={() => openVault()}
          className="px-3 py-1.5 text-xs rounded-md bg-[var(--accent)] text-white hover:opacity-90 transition-opacity duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
        >
          Open Vault
        </button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 pt-8 text-center">
        <p className="text-xs text-[var(--text-muted)]">Vault is empty.</p>
        <button
          onClick={() => handleNewNote(vaultPath ?? "")}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-[var(--accent)] text-white hover:opacity-90 transition-opacity duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
        >
          <Plus size={12} />
          New Note
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {/* New note button at top */}
      <button
        onClick={() => handleNewNote(vaultPath ?? "")}
        className="flex items-center gap-1.5 px-3 py-1.5 mb-1 rounded-md text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors duration-150 cursor-pointer self-start focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
      >
        <Plus size={12} />
        New Note
      </button>

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
