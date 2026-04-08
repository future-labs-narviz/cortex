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
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [closeHovered, setCloseHovered] = useState(false);

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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          WebkitBackdropFilter: 'blur(4px)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: 640,
          maxWidth: '90vw',
          maxHeight: '80vh',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          overflow: 'hidden',
          animation: 'settingsIn 150ms ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div
          style={{
            width: 200,
            flexShrink: 0,
            background: 'var(--bg-primary)',
            borderRight: '1px solid var(--border)',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <h2
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              paddingLeft: 12,
              paddingTop: 8,
              paddingBottom: 8,
              fontFamily: '"JetBrains Mono", "SF Mono", monospace',
            }}
          >
            Settings
          </h2>
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            const isHovered = hoveredSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                onMouseEnter={() => setHoveredSection(section.id)}
                onMouseLeave={() => setHoveredSection(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  paddingLeft: 12,
                  paddingRight: 12,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'background 150ms, color 150ms',
                  background: isActive
                    ? 'var(--accent-soft)'
                    : isHovered
                      ? 'var(--muted)'
                      : 'transparent',
                  color: isActive
                    ? 'var(--accent)'
                    : 'var(--text-secondary)',
                }}
              >
                <Icon size={16} />
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
          }}
        >
          {activeSection === "general" && <GeneralSettings />}
          {activeSection === "appearance" && <AppearanceSettings />}
          {activeSection === "voice" && <VoiceSettings />}
          {activeSection === "integrations" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Plug size={18} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Integrations
                </h3>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                No integrations configured yet. Plugin support coming soon.
              </p>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          onMouseEnter={() => setCloseHovered(true)}
          onMouseLeave={() => setCloseHovered(false)}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            padding: 6,
            borderRadius: 'var(--radius-md)',
            color: closeHovered ? 'var(--text-primary)' : 'var(--text-muted)',
            background: closeHovered ? 'var(--muted)' : 'transparent',
            transition: 'all 150ms',
            cursor: 'pointer',
            border: 'none',
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
