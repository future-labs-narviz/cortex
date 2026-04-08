import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";

interface VoiceNotePlayerProps {
  src: string;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceNotePlayer({ src }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const onLoadedMetadata = () => setDuration(audio.duration);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onError = () => {
      console.warn("[Cortex] Failed to load audio:", src);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {
        console.warn("[Cortex] Audio playback failed");
      });
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = ratio * duration;
      setCurrentTime(audio.currentTime);
    },
    [duration]
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[var(--bg-tertiary)] border border-[var(--border)] my-2 max-w-sm">
      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--bg-primary)] hover:brightness-110 hover:scale-110 transition-all duration-150 ease cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)] shrink-0"
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>

      {/* Progress bar */}
      <div
        className="flex-1 h-1.5 bg-[var(--border)] rounded-full cursor-pointer relative"
        onClick={handleSeek}
      >
        <div
          className="absolute top-0 left-0 h-full bg-[var(--accent)] rounded-full transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Time display */}
      <span className="text-[10px] font-mono text-[var(--text-muted)] tabular-nums whitespace-nowrap">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}
