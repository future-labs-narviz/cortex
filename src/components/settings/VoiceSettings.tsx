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

const sectionCard: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 16,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: 12,
  display: 'block',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  paddingLeft: 12,
  paddingRight: 12,
  fontSize: 13,
  borderRadius: 'var(--radius-lg)',
  background: 'var(--muted)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  outline: 'none',
  transition: 'border-color 150ms',
};

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

  useEffect(() => {
    invoke<AudioDevice[]>("voice_get_devices")
      .then(setDevices)
      .catch(() => {
        setDevices([
          { name: "Default Microphone", id: "default" },
          { name: "Built-in Microphone", id: "builtin" },
        ]);
      });
  }, []);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Mic size={18} style={{ color: 'var(--accent)' }} />
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          Voice Settings
        </h3>
      </div>

      {/* Microphone selector */}
      <div style={sectionCard}>
        <label style={sectionLabel}>Microphone</label>
        <select
          value={selectedDevice ?? "default"}
          onChange={handleDeviceChange}
          style={selectStyle}
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* Mic level indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <Volume2 size={12} style={{ color: 'var(--text-muted)' }} />
          <div
            style={{
              flex: 1,
              height: 6,
              background: 'var(--border)',
              borderRadius: 9999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                background: 'var(--green)',
                borderRadius: 9999,
                transition: 'width 100ms',
                width: `${micLevel * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Model selector */}
      <div style={sectionCard}>
        <label style={sectionLabel}>Transcription Model</label>
        <ModelSelector />
      </div>

      {/* Language */}
      <div style={sectionCard}>
        <label style={sectionLabel}>Language</label>
        <select
          value={selectedLanguage}
          onChange={handleLanguageChange}
          style={selectStyle}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Toggles */}
      <div style={sectionCard}>
        <label style={sectionLabel}>Behavior</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Auto-transcribe after recording
            </span>
            <input
              type="checkbox"
              checked={autoTranscribe}
              onChange={(e) => setAutoTranscribe(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Create voice note (vs. insert at cursor)
            </span>
            <input
              type="checkbox"
              checked={createVoiceNote}
              onChange={(e) => setCreateVoiceNote(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
