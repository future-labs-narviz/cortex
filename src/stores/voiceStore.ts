import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface VoiceStore {
  isRecording: boolean;
  isTranscribing: boolean;
  recordingDuration: number;
  audioLevels: number[];
  lastTranscription: string | null;
  error: string | null;
  selectedDevice: string | null;
  selectedModel: string | null;
  selectedLanguage: string;
  autoTranscribe: boolean;
  createVoiceNote: boolean;

  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  cancelRecording: () => Promise<void>;
  setDevice: (name: string) => void;
  setModel: (id: string) => void;
  setLanguage: (lang: string) => void;
  setAutoTranscribe: (v: boolean) => void;
  setCreateVoiceNote: (v: boolean) => void;
  setIsRecording: (v: boolean) => void;
  setIsTranscribing: (v: boolean) => void;
  setRecordingDuration: (v: number) => void;
  setAudioLevels: (levels: number[]) => void;
  setLastTranscription: (text: string | null) => void;
  setError: (err: string | null) => void;
}

let timerInterval: ReturnType<typeof setInterval> | null = null;

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  isRecording: false,
  isTranscribing: false,
  recordingDuration: 0,
  audioLevels: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  lastTranscription: null,
  error: null,
  selectedDevice: null,
  selectedModel: "whisper-small",
  selectedLanguage: "auto",
  autoTranscribe: true,
  createVoiceNote: false,

  startRecording: async () => {
    try {
      set({ error: null, recordingDuration: 0, lastTranscription: null });
      await invoke("voice_start_recording").catch(() => {
        console.warn("[Cortex] voice_start_recording not yet implemented");
      });
      set({ isRecording: true });

      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        set((s) => ({ recordingDuration: s.recordingDuration + 1 }));
      }, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isRecording: false });
    }
  },

  stopRecording: async () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    set({ isRecording: false, isTranscribing: true });

    try {
      const text = await invoke<string>("voice_stop_recording").catch(() => {
        console.warn("[Cortex] voice_stop_recording not yet implemented");
        return "[Voice transcription placeholder - backend not connected]";
      });
      set({
        isTranscribing: false,
        lastTranscription: text,
        audioLevels: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      });
      return text;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ isTranscribing: false, error: message });
      return "";
    }
  },

  cancelRecording: async () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    set({
      isRecording: false,
      isTranscribing: false,
      recordingDuration: 0,
      audioLevels: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    await invoke("voice_cancel_recording").catch(() => {
      console.warn("[Cortex] voice_cancel_recording not yet implemented");
    });
  },

  setDevice: (name) => set({ selectedDevice: name }),
  setModel: (id) => set({ selectedModel: id }),
  setLanguage: (lang) => set({ selectedLanguage: lang }),
  setAutoTranscribe: (v) => set({ autoTranscribe: v }),
  setCreateVoiceNote: (v) => set({ createVoiceNote: v }),
  setIsRecording: (v) => set({ isRecording: v }),
  setIsTranscribing: (v) => set({ isTranscribing: v }),
  setRecordingDuration: (v) => set({ recordingDuration: v }),
  setAudioLevels: (levels) => set({ audioLevels: levels }),
  setLastTranscription: (text) => set({ lastTranscription: text }),
  setError: (err) => set({ error: err }),
}));
