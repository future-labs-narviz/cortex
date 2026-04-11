import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { VaultFile } from "@/lib/types";

async function callCommand<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    console.warn(`Command ${cmd} not available:`, e);
    throw e;
  }
}

interface VaultStore {
  vaultPath: string | null;
  isVaultOpen: boolean;
  files: VaultFile[];
  activeFilePath: string | null;
  expandedFolders: Set<string>;

  openVault: () => Promise<void>;
  closeVault: () => void;
  refreshFiles: () => Promise<void>;
  setActiveFile: (path: string) => void;
  toggleFolder: (path: string) => void;

  createNote: (title: string, folder?: string) => Promise<string>;
  renameNote: (oldPath: string, newPath: string) => Promise<void>;
  deleteNote: (path: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
}

function sortFiles(files: VaultFile[]): VaultFile[] {
  return [...files]
    .sort((a, b) => {
      if (a.is_dir && !b.is_dir) return -1;
      if (!a.is_dir && b.is_dir) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    })
    .map((f) =>
      f.is_dir && f.children
        ? { ...f, children: sortFiles(f.children) }
        : f,
    );
}

function flattenFiles(files: VaultFile[]): VaultFile[] {
  const result: VaultFile[] = [];
  for (const file of files) {
    if (!file.is_dir) {
      result.push(file);
    }
    if (file.children) {
      result.push(...flattenFiles(file.children));
    }
  }
  return result;
}

export { flattenFiles };

export const useVaultStore = create<VaultStore>((set, get) => ({
  vaultPath: null,
  isVaultOpen: false,
  files: [],
  activeFilePath: null,
  expandedFolders: new Set<string>(),

  openVault: async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;

    const path = typeof selected === "string" ? selected : selected;
    // Await the backend open_vault BEFORE flipping isVaultOpen to true.
    // Otherwise Sheet.tsx's vault-open gate passes while the backend
    // still has state.vault == None, and any sheet that tries to
    // `read_note` or `list_plan_notes` on mount (e.g. a restored
    // plan-runner sheet, or SessionsPanel) fails with "No vault is
    // currently open" before the backend has finished opening it.
    try {
      await callCommand("open_vault", { path });
    } catch {
      // Backend command may not exist yet; fall back to opening
      // locally so the UI is not wedged.
    }

    set({ vaultPath: path, isVaultOpen: true });
    localStorage.setItem("cortex-vault-path", path);
    await get().refreshFiles();
  },

  closeVault: () =>
    set({
      vaultPath: null,
      isVaultOpen: false,
      files: [],
      activeFilePath: null,
      expandedFolders: new Set<string>(),
    }),

  refreshFiles: async () => {
    const { vaultPath } = get();
    if (!vaultPath) return;

    try {
      const files = await callCommand<VaultFile[]>("list_files");
      set({ files: sortFiles(files) });
    } catch {
      // Backend not available yet - leave files empty
      console.warn("[Cortex] list_files not available, files not refreshed");
    }
  },

  setActiveFile: (path: string) => set({ activeFilePath: path }),

  toggleFolder: (path: string) =>
    set((state) => {
      const next = new Set(state.expandedFolders);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { expandedFolders: next };
    }),

  createNote: async (title: string, folder?: string) => {
    const { vaultPath } = get();
    if (!vaultPath) throw new Error("No vault open");

    try {
      // Rust expects { title, folder } and returns relative path
      const path = await callCommand<string>("create_note", {
        title,
        folder: folder || null,
      });
      await get().refreshFiles();
      return path;
    } catch {
      console.warn("[Cortex] create_note not available");
      await get().refreshFiles();
      return `${title}.md`;
    }
  },

  renameNote: async (oldPath: string, newPath: string) => {
    try {
      await callCommand("rename_note", { oldPath, newPath });
    } catch {
      console.warn("[Cortex] rename_note not available");
    }
    await get().refreshFiles();
  },

  deleteNote: async (path: string) => {
    try {
      await callCommand("delete_note", { path });
    } catch {
      console.warn("[Cortex] delete_note not available");
    }
    await get().refreshFiles();
  },

  createFolder: async (path: string) => {
    try {
      await callCommand("create_folder", { path });
    } catch {
      console.warn("[Cortex] create_folder not available");
    }
    await get().refreshFiles();
  },
}));
