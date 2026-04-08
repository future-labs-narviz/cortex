import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

interface SearchStore {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  setQuery: (q: string) => void;
  search: (query: string) => Promise<void>;
  clearResults: () => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  query: "",
  results: [],
  isSearching: false,

  setQuery: (q: string) => set({ query: q }),

  search: async (query: string) => {
    if (!query.trim()) {
      set({ results: [], isSearching: false });
      return;
    }

    set({ isSearching: true });
    try {
      const results = await invoke<SearchResult[]>("full_text_search", {
        query,
        limit: 20,
      });
      set({ results, isSearching: false });
    } catch (e) {
      console.warn("[Cortex] full_text_search failed:", e);
      set({ results: [], isSearching: false });
    }
  },

  clearResults: () => set({ query: "", results: [], isSearching: false }),
}));
