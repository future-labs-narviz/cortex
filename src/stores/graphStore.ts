import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { GraphData } from "@/lib/types";

interface GraphStore {
  data: GraphData | null;
  mode: "local" | "global";
  depth: number;
  showOrphans: boolean;
  isLoading: boolean;
  error: string | null;
  setMode: (mode: "local" | "global") => void;
  setDepth: (depth: number) => void;
  toggleOrphans: () => void;
  fetchGraphData: (center?: string) => Promise<void>;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  data: null,
  mode: "local",
  depth: 1,
  showOrphans: false,
  isLoading: false,
  error: null,

  setMode: (mode) => set({ mode }),

  setDepth: (depth) => set({ depth: Math.max(1, Math.min(3, depth)) }),

  toggleOrphans: () => set((s) => ({ showOrphans: !s.showOrphans })),

  fetchGraphData: async (center?: string) => {
    const { mode, depth } = get();
    set({ isLoading: true, error: null });

    try {
      const data = await invoke<GraphData>("get_graph_data", {
        center: mode === "local" ? (center ?? null) : null,
        depth,
      });
      set({ data, isLoading: false });
    } catch (e) {
      console.warn("[Cortex] get_graph_data failed:", e);
      set({
        isLoading: false,
        error: "Could not load graph data",
        data: null,
      });
    }
  },
}));
