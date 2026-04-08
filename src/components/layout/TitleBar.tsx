import { PanelLeft, Sun, Moon } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

const TITLE_COLORS_DARK = [
  '#3b82f6', // C — blue
  '#8b5cf6', // o — purple
  '#06b6d4', // r — cyan
  '#10b981', // t — green
  '#f59e0b', // e — amber
  '#ef4444', // x — red
];

const TITLE_COLORS_LIGHT = [
  '#2563eb', // C — blue (darker)
  '#7c3aed', // o — purple
  '#0891b2', // r — cyan
  '#059669', // t — green
  '#d97706', // e — amber
  '#dc2626', // x — red
];

export function TitleBar() {
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const iconBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 'var(--radius-md)',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 150ms',
  };

  const handleHover = (e: React.MouseEvent, entering: boolean) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.style.background = entering ? 'var(--muted)' : 'transparent';
    btn.style.color = entering ? 'var(--text-secondary)' : 'var(--text-muted)';
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 40,
        paddingLeft: 80,
        paddingRight: 12,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        userSelect: 'none',
      }}
      data-tauri-drag-region
    >
      {/* Sidebar toggle — left of title */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleSidebar(); }}
        onMouseEnter={(e) => handleHover(e, true)}
        onMouseLeave={(e) => handleHover(e, false)}
        style={{ ...iconBtnStyle, marginRight: 10 }}
        aria-label="Toggle sidebar"
      >
        <PanelLeft style={{ width: 15, height: 15 }} />
      </button>

      {/* Cortex title — colored letters */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.06em',
          fontFamily: '"JetBrains Mono", monospace',
        }}
        data-tauri-drag-region
      >
        {'Cortex'.split('').map((letter, i) => (
          <span key={i} style={{ color: (theme === 'dark' ? TITLE_COLORS_DARK : TITLE_COLORS_LIGHT)[i] }}>{letter}</span>
        ))}
      </span>

      {/* Spacer for dragging */}
      <div style={{ flex: 1 }} data-tauri-drag-region />

      {/* Theme toggle — far right */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
        onMouseEnter={(e) => handleHover(e, true)}
        onMouseLeave={(e) => handleHover(e, false)}
        style={iconBtnStyle}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? (
          <Sun style={{ width: 15, height: 15 }} />
        ) : (
          <Moon style={{ width: 15, height: 15 }} />
        )}
      </button>
    </div>
  );
}
