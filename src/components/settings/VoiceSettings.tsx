import { useState, useEffect, useCallback } from "react";
import { Mic, Volume2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useVoiceStore } from "@/stores/voiceStore";
import { ModelSelector } from "@/components/voice/ModelSelector";

interface AudioDevice {
  name: string;
  id: string;
}

const LANGUAGES = [
  { code: "auto", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
];

export function VoiceSettings() {
  const {
    selectedDevice,
    selectedLanguage,
    autoTranscribe,
    createVoiceNote,
    setDevice,
    setLanguage,
    setAutoTranscribe,
    setCreateVoiceNote,
  } = useVoiceStore();

  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [micLevel, setMicLevel] = useState(0);

  // Load devices
  useEffect(() => {
    invoke<AudioDevice[]>("voice_get_devices")
      .then(setDevices)
      .catch(() => {
        // Backend not implemented yet, show placeholder
        setDevices([
          { name: "Default Microphone", id: "default" },
          { name: "Built-in Microphone", id: "builtin" },
        ]);
      });
  }, []);

  // Mock mic level indicator
  useEffect(() => {
    const interval = setInterval(() => {
      setMicLevel(Math.random() * 0.6 + 0.1);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  const handleDeviceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setDevice(e.target.value);
    },
    [setDevice]
  );

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setLanguage(e.target.value);
    },
    [setLanguage]
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 mb-1">
        <Mic size={18} className="text-[var(--accent)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Voice Settings
        </h3>
      </div>

      {/* Microphone selector */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <label className="text-sm font-semibold text-[var(--text-primary)] mb-3 block">Microphone</label>
        <select
          value={selectedDevice ?? "default"}
          onChange={handleDeviceChange}
          className="w-full h-9 px-3 text-sm rounded-[var(--radius-lg)] bg-[var(--muted)] border border-[var(--border)] text-[var(--text-primary)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 transition-colors duration-150 ease-in-out"
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* Mic level indicator */}
        <div className="flex items-center gap-2 mt-3">
          <Volume2 size={12} className="text-[var(--text-muted)]" />
          <div className="flex-1 h-1.5 bg-[var(--border)] rounded-[var(--radius-full)] overflow-hidden">
            <div
              className="h-full bg-[var(--green)] rounded-[var(--radius-full)] transition-[width] duration-100"
              style={{ width: `${micLevel * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Model selector */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <label className="text-sm font-semibold text-[var(--text-primary)] mb-3 block">
          Transcription Model
        </label>
        <ModelSelector />
      </div>

      {/* Language */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <label className="text-sm font-semibold text-[var(--text-primary)] mb-3 block">Language</label>
        <select
          value={selectedLanguage}
          onChange={handleLanguageChange}
          className="w-full h-9 px-3 text-sm rounded-[var(--radius-lg)] bg-[var(--muted)] border border-[var(--border)] text-[var(--text-primary)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 transition-colors duration-150 ease-in-out"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Toggles */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <label className="text-sm font-semibold text-[var(--text-primary)] mb-3 block">Behavior</label>
        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[var(--text-secondary)]">
              Auto-transcribe after recording
            </span>
            <input
              type="checkbox"
              checked={autoTranscribe}
              onChange={(e) => setAutoTranscribe(e.target.checked)}
              className="w-4 h-4 accent-[var(--accent)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[var(--text-secondary)]">
              Create voice note (vs. insert at cursor)
            </span>
            <input
              type="checkbox"
              checked={createVoiceNote}
              onChange={(e) => setCreateVoiceNote(e.target.checked)}
              className="w-4 h-4 accent-[var(--accent)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
