import { useCallback, useState } from "react";
import { Palette, RotateCcw } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

const FONT_OPTIONS = [
  { value: "system", label: "System Default" },
  { value: "jetbrains", label: "JetBrains Mono" },
  { value: "fira", label: "Fira Code" },
  { value: "inter", label: "Inter" },
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

const rangeLabel: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-secondary)',
};

const rangeBounds: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 11,
  color: 'var(--text-muted)',
};

export function AppearanceSettings() {
  const {
    theme,
    fontFamily,
    fontSize,
    lineHeight,
    sidebarWidth,
    customCSS,
    setTheme,
    setFontFamily,
    setFontSize,
    setLineHeight,
    setSidebarWidth,
    setCustomCSS,
  } = useSettingsStore();

  const [resetHovered, setResetHovered] = useState(false);

  const handleResetDefaults = useCallback(() => {
    setTheme("dark");
    setFontFamily("system");
    setFontSize(14);
    setLineHeight(1.6);
    setSidebarWidth(250);
    setCustomCSS("");
  }, [setTheme, setFontFamily, setFontSize, setLineHeight, setSidebarWidth, setCustomCSS]);

  const themeButtonStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 'var(--radius-xl)',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 150ms',
    background: active ? 'var(--accent-soft)' : 'var(--muted)',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Palette size={18} style={{ color: 'var(--accent)' }} />
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          Appearance
        </h3>
      </div>

      {/* Theme toggle */}
      <div style={sectionCard}>
        <label style={sectionLabel}>Theme</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTheme("dark")} style={themeButtonStyle(theme === "dark")}>
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '1px solid var(--border)',
                background: '#0f1117',
              }}
            />
            Dark
          </button>
          <button onClick={() => setTheme("light")} style={themeButtonStyle(theme === "light")}>
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '1px solid var(--border)',
                background: '#f8f9fa',
              }}
            />
            Light
          </button>
        </div>
      </div>

      {/* Font family */}
      <div style={sectionCard}>
        <label style={sectionLabel}>Font Family</label>
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          style={{
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
          }}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Font size & Line height & Sidebar width */}
      <div style={sectionCard}>
        <label style={sectionLabel}>Layout</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={rangeLabel}>Font Size: {fontSize}px</label>
            <input
              type="range"
              min={12}
              max={20}
              step={1}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <div style={rangeBounds}>
              <span>12px</span>
              <span>20px</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={rangeLabel}>Editor Line Height: {lineHeight.toFixed(1)}</label>
            <input
              type="range"
              min={1.4}
              max={2.0}
              step={0.1}
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <div style={rangeBounds}>
              <span>1.4</span>
              <span>2.0</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={rangeLabel}>Sidebar Width: {sidebarWidth}px</label>
            <input
              type="range"
              min={200}
              max={400}
              step={10}
              value={sidebarWidth}
              onChange={(e) => setSidebarWidth(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <div style={rangeBounds}>
              <span>200px</span>
              <span>400px</span>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS */}
      <div style={sectionCard}>
        <label style={sectionLabel}>Custom CSS</label>
        <textarea
          value={customCSS}
          onChange={(e) => setCustomCSS(e.target.value)}
          placeholder="/* Add custom CSS overrides here */"
          rows={5}
          spellCheck={false}
          style={{
            width: '100%',
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 8,
            paddingBottom: 8,
            fontSize: 12,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: '"JetBrains Mono", "SF Mono", monospace',
            resize: 'vertical',
            outline: 'none',
            transition: 'border-color 150ms',
          }}
        />
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Custom styles saved to .cortex/custom.css
        </p>
      </div>

      {/* Reset */}
      <button
        onClick={handleResetDefaults}
        onMouseEnter={() => setResetHovered(true)}
        onMouseLeave={() => setResetHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
          borderRadius: 'var(--radius-lg)',
          fontSize: 13,
          background: 'var(--muted)',
          border: resetHovered ? '1px solid var(--red)' : '1px solid var(--border)',
          color: resetHovered ? 'var(--red)' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 150ms',
        }}
      >
        <RotateCcw size={14} />
        Reset to Defaults
      </button>
    </div>
  );
}
