import { useCallback } from "react";
import { Mic, Plus } from "lucide-react";
import { useVoiceStore } from "@/stores/voiceStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { invoke } from "@tauri-apps/api/core";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function generateVoiceNoteContent(
  transcription: string,
  duration: number,
  filename: string
): string {
  const now = new Date();
  const dateStr = formatDate(now);
  const timeStr = formatTime(now);
  const durationStr = formatDuration(duration);
  const isoStr = now.toISOString();

  return `---
type: voice-note
created: ${isoStr}
duration: ${durationStr}
audio: .cortex/recordings/${filename}.wav
tags: [voice-note]
---

# Voice Note - ${dateStr}

${transcription}

---
*Recorded at ${timeStr} | Duration: ${durationStr}*
`;
}

export function VoiceNoteCreator() {
  const { isRecording, isTranscribing, recordingDuration, startRecording, stopRecording } =
    useVoiceStore();
  const createNote = useVaultStore((s) => s.createNote);
  const setActiveFile = useVaultStore((s) => s.setActiveFile);
  const openTab = useEditorStore((s) => s.openTab);

  const handleClick = useCallback(async () => {
    if (isTranscribing) return;

    if (isRecording) {
      const text = await stopRecording();
      if (!text) return;

      const timestamp = Date.now();
      const filename = `voice-${timestamp}`;
      const content = generateVoiceNoteContent(text, recordingDuration, filename);
      const title = `Voice Note ${new Date().toLocaleDateString()}`;

      try {
        const path = await createNote(title);
        await invoke("save_note", { path, content }).catch(() => {
          console.warn("[Cortex] save_note failed for voice note");
        });
        setActiveFile(path);
        openTab(path, content);
      } catch (err) {
        console.warn("[Cortex] Failed to create voice note:", err);
      }
    } else {
      await startRecording();
    }
  }, [
    isRecording,
    isTranscribing,
    recordingDuration,
    startRecording,
    stopRecording,
    createNote,
    setActiveFile,
    openTab,
  ]);

  return (
    <button
      onClick={handleClick}
      disabled={isTranscribing}
      className={`flex items-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ease cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)] disabled:opacity-50 disabled:cursor-not-allowed ${
        isRecording
          ? "bg-[var(--red)]/15 text-[var(--red)] hover:bg-[var(--red)]/25"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
      }`}
    >
      <div className="flex items-center justify-center w-5 h-5 relative">
        <Mic size={16} />
        {!isRecording && (
          <Plus
            size={10}
            className="absolute -bottom-0.5 -right-0.5 text-[var(--accent)]"
          />
        )}
      </div>
      <span>
        {isRecording
          ? "Stop & Create Note"
          : isTranscribing
            ? "Transcribing..."
            : "New Voice Note"}
      </span>
    </button>
  );
}
