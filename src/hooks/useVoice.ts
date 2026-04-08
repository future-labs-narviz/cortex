import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useVoiceStore } from "@/stores/voiceStore";

export function useVoice() {
  const store = useVoiceStore();

  useEffect(() => {
    const unlisten = Promise.all([
      listen<number[]>("voice:audio-level", (e) => {
        useVoiceStore.getState().setAudioLevels(e.payload);
      }),
      listen<string>("voice:transcription-complete", (e) => {
        const state = useVoiceStore.getState();
        state.setIsTranscribing(false);
        state.setLastTranscription(e.payload);
      }),
      listen("voice:recording-started", () => {
        useVoiceStore.getState().setIsRecording(true);
      }),
      listen("voice:recording-stopped", () => {
        useVoiceStore.getState().setIsRecording(false);
      }),
      listen<string>("voice:error", (e) => {
        useVoiceStore.getState().setError(e.payload);
      }),
    ]);

    return () => {
      unlisten.then((fns) => fns.forEach((fn) => fn()));
    };
  }, []);

  return store;
}
