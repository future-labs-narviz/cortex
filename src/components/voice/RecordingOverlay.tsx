import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useVoiceStore } from "@/stores/voiceStore";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function RecordingOverlay() {
  const {
    isRecording,
    isTranscribing,
    recordingDuration,
    audioLevels,
    cancelRecording,
  } = useVoiceStore();

  // Mock audio levels when the backend isn't sending real data
  const [mockLevels, setMockLevels] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0]);

  useEffect(() => {
    if (!isRecording) {
      setMockLevels([0, 0, 0, 0, 0, 0, 0, 0, 0]);
      return;
    }

    const allZero = audioLevels.every((l) => l === 0);
    if (!allZero) return; // real levels are coming in, don't mock

    const interval = setInterval(() => {
      setMockLevels(
        Array.from({ length: 9 }, () => Math.random() * 0.7 + 0.15)
      );
    }, 120);

    return () => clearInterval(interval);
  }, [isRecording, audioLevels]);

  if (!isRecording && !isTranscribing) return null;

  const levels = audioLevels.every((l) => l === 0) ? mockLevels : audioLevels;

  return (
    <div className="recording-overlay relative flex items-center gap-4 px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)] shrink-0">
      {/* Audio bars */}
      <div className="voice-bars">
        {levels.map((level, i) => (
          <div
            key={i}
            className="voice-bar"
            style={{
              height: `${Math.max(4, level * 32)}px`,
            }}
          />
        ))}
      </div>

      {/* Duration timer */}
      <span className="text-sm font-mono tabular-nums text-[var(--text-primary)]">
        {formatDuration(recordingDuration)}
      </span>

      {/* Status text */}
      <span className="text-xs text-[var(--text-muted)]">
        {isTranscribing ? "Transcribing..." : "Recording..."}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Cancel button */}
      <button
        onClick={cancelRecording}
        className="flex items-center justify-center w-6 h-6 rounded-[6px] hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--red)] transition-colors duration-150 ease cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
        title="Cancel recording"
      >
        <X size={14} />
      </button>
    </div>
  );
}
