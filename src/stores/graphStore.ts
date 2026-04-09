import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { GraphData, KgGraphData, KgEntityProfile, KgStats, GraphLayer } from "@/lib/types";

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

  // Typed knowledge graph
  kgData: KgGraphData | null;
  selectedEntity: KgEntityProfile | null;
  kgStats: KgStats | null;
  graphLayer: GraphLayer;
  setGraphLayer: (layer: GraphLayer) => void;
  fetchKgData: () => Promise<void>;
  selectEntity: (name: string) => Promise<void>;
  clearSelectedEntity: () => void;
  fetchKgStats: () => Promise<void>;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  data: null,
  mode: "local",
  depth: 1,
  showOrphans: false,
  isLoading: false,
  error: null,

  // Typed knowledge graph
  kgData: null,
  selectedEntity: null,
  kgStats: null,
  graphLayer: "wikilinks",

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

  setGraphLayer: (layer) => set({ graphLayer: layer }),

  fetchKgData: async () => {
    set({ isLoading: true, error: null });
    try {
      const kgData = await invoke<KgGraphData>("get_kg_graph_data", {});
      set({ kgData, isLoading: false });
    } catch (e) {
      console.warn("[Cortex] get_kg_graph_data failed:", e);
      set({ isLoading: false, error: "Could not load typed graph data" });
    }
  },

  selectEntity: async (name: string) => {
    try {
      const profile = await invoke<KgEntityProfile>("get_entity_profile", { name });
      set({ selectedEntity: profile });
    } catch (e) {
      console.warn("[Cortex] get_entity_profile failed:", e);
    }
  },

  clearSelectedEntity: () => set({ selectedEntity: null }),

  fetchKgStats: async () => {
    try {
      const kgStats = await invoke<KgStats>("get_kg_stats", {});
      set({ kgStats });
    } catch (e) {
      console.warn("[Cortex] get_kg_stats failed:", e);
    }
  },
}));
