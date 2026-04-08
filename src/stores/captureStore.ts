import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import type { CapturedSession, CapturedInsight } from "@/lib/types";

const CAPTURE_API = "http://localhost:3847/api/capture";

interface CaptureStore {
  sessions: CapturedSession[];
  insights: CapturedInsight[];
  isLoading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;
  addSession: (session: CapturedSession) => void;
  addInsight: (insight: CapturedInsight) => void;
}

export const useCaptureStore = create<CaptureStore>((set, get) => ({
  sessions: [],
  insights: [],
  isLoading: false,
  error: null,

  fetchSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${CAPTURE_API}/sessions`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      }
      const data = await response.json();
      set({
        sessions: data.sessions ?? [],
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch sessions",
      });
    }
  },

  addSession: (session: CapturedSession) => {
    set((state) => ({
      sessions: [session, ...state.sessions.filter((s) => s.session_id !== session.session_id)],
    }));
  },

  addInsight: (insight: CapturedInsight) => {
    set((state) => ({
      insights: [insight, ...state.insights],
    }));
  },
}));

// Listen for real-time Tauri events and update the store.
let listenersInitialized = false;

export function initCaptureListeners() {
  if (listenersInitialized) return;
  listenersInitialized = true;

  listen<{ session_id: string; summary: string | null }>(
    "capture:session-end",
    (_event) => {
      // Refetch all sessions to get the complete data.
      useCaptureStore.getState().fetchSessions();
    },
  );

  listen<CapturedInsight>("capture:insight", (event) => {
    const insight: CapturedInsight = {
      id: crypto.randomUUID(),
      content: event.payload.content,
      tags: event.payload.tags ?? [],
      source: event.payload.source ?? "claude-code",
      created_at: event.payload.created_at ?? new Date().toISOString(),
    };
    useCaptureStore.getState().addInsight(insight);
  });
}
