import { useState, useEffect, useCallback } from "react";
import { X, Settings, Palette, Mic, Plug } from "lucide-react";
import { GeneralSettings } from "./GeneralSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { VoiceSettings } from "./VoiceSettings";

type Section = "general" | "appearance" | "voice" | "integrations";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SECTIONS: { id: Section; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "integrations", label: "Integrations", icon: Plug },
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<Section>("general");

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-[700px] max-w-[90vw] h-[520px] max-h-[80vh] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-2xl flex overflow-hidden animate-[settingsIn_150ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-[180px] flex-shrink-0 bg-[var(--bg-primary)] border-r border-[var(--border)] p-3 flex flex-col gap-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] px-2 py-2">
            Settings
          </h2>
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer ${
                  activeSection === section.id
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                <Icon size={16} />
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === "general" && <GeneralSettings />}
          {activeSection === "appearance" && <AppearanceSettings />}
          {activeSection === "voice" && <VoiceSettings />}
          {activeSection === "integrations" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <Plug size={18} className="text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Integrations
                </h3>
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                No integrations configured yet. Plugin support coming soon.
              </p>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
