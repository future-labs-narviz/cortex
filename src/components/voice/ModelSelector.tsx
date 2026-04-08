import { useState, useCallback } from "react";
import { Download, Check, Loader2, ChevronDown } from "lucide-react";
import { useVoiceStore } from "@/stores/voiceStore";

interface ModelInfo {
  id: string;
  name: string;
  size: string;
  accuracy: string;
  speed: string;
  languages: string;
}

const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: "whisper-small",
    name: "Whisper Small",
    size: "244 MB",
    accuracy: "Good",
    speed: "Fast",
    languages: "99 languages",
  },
  {
    id: "whisper-medium",
    name: "Whisper Medium",
    size: "769 MB",
    accuracy: "Very Good",
    speed: "Medium",
    languages: "99 languages",
  },
  {
    id: "parakeet-v3",
    name: "Parakeet V3",
    size: "620 MB",
    accuracy: "Excellent",
    speed: "Fast",
    languages: "English only",
  },
  {
    id: "moonshine-v2-small",
    name: "Moonshine V2 Small",
    size: "180 MB",
    accuracy: "Good",
    speed: "Very Fast",
    languages: "English only",
  },
];

type DownloadStatus = "available" | "downloading" | "downloaded";

export function ModelSelector() {
  const selectedModel = useVoiceStore((s) => s.selectedModel);
  const setModel = useVoiceStore((s) => s.setModel);
  const [isOpen, setIsOpen] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<
    Record<string, { status: DownloadStatus; progress?: number }>
  >({
    "whisper-small": { status: "downloaded" },
    "whisper-medium": { status: "available" },
    "parakeet-v3": { status: "available" },
    "moonshine-v2-small": { status: "available" },
  });

  const handleDownload = useCallback(
    (modelId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const current = downloadStatus[modelId];
      if (current?.status === "downloaded" || current?.status === "downloading")
        return;

      setDownloadStatus((prev) => ({
        ...prev,
        [modelId]: { status: "downloading", progress: 0 },
      }));

      // Simulate download progress (backend not implemented yet)
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        if (progress >= 100) {
          clearInterval(interval);
          setDownloadStatus((prev) => ({
            ...prev,
            [modelId]: { status: "downloaded" },
          }));
        } else {
          setDownloadStatus((prev) => ({
            ...prev,
            [modelId]: { status: "downloading", progress: Math.floor(progress) },
          }));
        }
      }, 500);
    },
    [downloadStatus]
  );

  const handleSelect = useCallback(
    (modelId: string) => {
      if (downloadStatus[modelId]?.status === "downloaded") {
        setModel(modelId);
        setIsOpen(false);
      }
    },
    [downloadStatus, setModel]
  );

  const currentModel = AVAILABLE_MODELS.find((m) => m.id === selectedModel);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full gap-2 px-3 py-2 text-sm rounded-[var(--radius-xl)] bg-[var(--muted)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--muted-hover)] transition-colors duration-150 ease cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
      >
        <span>{currentModel?.name ?? "Select model"}</span>
        <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[300px] rounded-[var(--radius-xl)] bg-[var(--bg-elevated)] border border-[var(--border)] shadow-[var(--shadow-lg)] overflow-hidden">
          {AVAILABLE_MODELS.map((model) => {
            const status = downloadStatus[model.id];
            const isSelected = selectedModel === model.id;
            const isDownloaded = status?.status === "downloaded";

            return (
              <div
                key={model.id}
                onClick={() => handleSelect(model.id)}
                tabIndex={isDownloaded ? 0 : undefined}
                role="option"
                aria-selected={isSelected}
                className={`flex items-start gap-3 px-3 py-2 rounded-[var(--radius-md)] transition-colors duration-150 ease text-sm ${
                  isDownloaded ? "cursor-pointer hover:bg-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent)]" : ""
                } ${isSelected ? "bg-[var(--accent-soft)]" : ""}`}
              >
                {/* Selection indicator */}
                <div className="flex items-center justify-center w-4 h-4 mt-0.5 shrink-0">
                  {isSelected && (
                    <Check size={14} className="text-[var(--accent)]" />
                  )}
                </div>

                {/* Model info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {model.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                      {model.size}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      Accuracy: {model.accuracy}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      Speed: {model.speed}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {model.languages}
                    </span>
                  </div>
                  {status?.status === "downloading" && (
                    <div className="mt-1.5 w-full h-1 bg-[var(--border)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-[width] duration-300"
                        style={{ width: `${status.progress ?? 0}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Download / status button */}
                <div className="shrink-0 mt-0.5">
                  {status?.status === "downloaded" ? (
                    <span className="text-[10px] text-[var(--green)]">
                      Downloaded
                    </span>
                  ) : status?.status === "downloading" ? (
                    <div className="flex items-center gap-1 text-[var(--accent)]">
                      <Loader2 size={12} className="animate-spin" />
                      <span className="text-[10px]">{status.progress}%</span>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => handleDownload(model.id, e)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors duration-150 ease cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
                    >
                      <Download size={10} />
                      Download
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
