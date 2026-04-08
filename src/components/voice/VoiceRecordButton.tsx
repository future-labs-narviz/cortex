import { useRef, useCallback } from "react";
import { Mic, Loader2 } from "lucide-react";
import { useVoiceStore } from "@/stores/voiceStore";

interface VoiceRecordButtonProps {
  position?: "toolbar" | "fab";
  onTranscriptionComplete?: (text: string) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecordButton({
  position = "toolbar",
  onTranscriptionComplete,
}: VoiceRecordButtonProps) {
  const { isRecording, isTranscribing, recordingDuration, startRecording, stopRecording } =
    useVoiceStore();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const handleStart = useCallback(async () => {
    if (isTranscribing) return;
    if (isRecording) {
      const text = await stopRecording();
      if (text && onTranscriptionComplete) {
        onTranscriptionComplete(text);
      }
    } else {
      await startRecording();
    }
  }, [isRecording, isTranscribing, startRecording, stopRecording, onTranscriptionComplete]);

  const handlePointerDown = useCallback(() => {
    if (isTranscribing) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(async () => {
      isLongPress.current = true;
      if (!isRecording) {
        await startRecording();
      }
    }, 400);
  }, [isRecording, isTranscribing, startRecording]);

  const handlePointerUp = useCallback(async () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isLongPress.current && isRecording) {
      isLongPress.current = false;
      const text = await stopRecording();
      if (text && onTranscriptionComplete) {
        onTranscriptionComplete(text);
      }
    }
  }, [isRecording, stopRecording, onTranscriptionComplete]);

  const handleClick = useCallback(() => {
    if (!isLongPress.current) {
      handleStart();
    }
    isLongPress.current = false;
  }, [handleStart]);

  if (position === "fab") {
    return (
      <button
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        disabled={isTranscribing}
        className={`voice-record-btn fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] transition-all duration-150 ease cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)] disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[var(--shadow-glow)] hover:scale-[1.02] active:scale-[0.98] ${
          isRecording
            ? "recording bg-[var(--red)] text-[var(--bg-primary)]"
            : "btn-primary text-white"
        }`}
        title={isRecording ? "Stop recording" : isTranscribing ? "Transcribing..." : "Start recording"}
        aria-label={isRecording ? "Stop recording" : isTranscribing ? "Transcribing" : "Start recording"}
      >
        {isTranscribing ? (
          <Loader2 size={24} className="animate-spin" />
        ) : (
          <Mic size={24} />
        )}
        {isRecording && (
          <span className="absolute -top-2 -right-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-[var(--border)]">
            {formatDuration(recordingDuration)}
          </span>
        )}
      </button>
    );
  }

  // Toolbar mode
  return (
    <button
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      disabled={isTranscribing}
      className={`voice-record-btn flex items-center gap-1.5 h-7 rounded-[var(--radius-md)] px-1.5 transition-colors duration-150 ease cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)] disabled:opacity-50 disabled:cursor-not-allowed ${
        isRecording
          ? "recording bg-[var(--red)]/20 text-[var(--red)]"
          : isTranscribing
            ? "text-[var(--text-muted)]"
            : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--muted)]"
      }`}
      title={isRecording ? "Stop recording" : isTranscribing ? "Transcribing..." : "Record voice (Cmd+Shift+R)"}
      aria-label={isRecording ? "Stop recording" : isTranscribing ? "Transcribing" : "Start recording"}
    >
      {isTranscribing ? (
        <Loader2 size={15} className="animate-spin" />
      ) : (
        <Mic size={15} />
      )}
      {isRecording && (
        <span className="text-[11px] font-mono tabular-nums">
          {formatDuration(recordingDuration)}
        </span>
      )}
    </button>
  );
}
