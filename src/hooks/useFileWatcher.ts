import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useVaultStore } from "@/stores/vaultStore";

export function useFileWatcher() {
  const refreshFiles = useVaultStore((s) => s.refreshFiles);

  useEffect(() => {
    const unlisten = Promise.all([
      listen("vault:file-created", () => refreshFiles()),
      listen("vault:file-modified", () => refreshFiles()),
      listen("vault:file-deleted", () => refreshFiles()),
    ]);

    return () => {
      unlisten.then((fns) => fns.forEach((fn) => fn()));
    };
  }, [refreshFiles]);
}
