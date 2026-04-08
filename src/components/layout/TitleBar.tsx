import { PanelLeft, Sun, Moon } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

const TITLE_COLORS_DARK = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444'];
const TITLE_COLORS_LIGHT = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#dc2626'];

export function TitleBar() {
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const isDark = theme === "dark";
  const colors = isDark ? TITLE_COLORS_DARK : TITLE_COLORS_LIGHT;

  const iconBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 'var(--radius-md)',
    background: 'transparent', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', transition: 'all 150ms',
  };

  const hover = (e: React.MouseEvent, on: boolean) => {
    const b = e.currentTarget as HTMLButtonElement;
    b.style.background = on ? 'var(--muted)' : 'transparent';
    b.style.color = on ? 'var(--text-secondary)' : 'var(--text-muted)';
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', height: 40,
        paddingLeft: 72, paddingRight: 12,
        background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
        userSelect: 'none',
      }}
      data-tauri-drag-region
    >
      {/* Sidebar toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); toggleSidebar(); }}
        onMouseEnter={(e) => hover(e, true)}
        onMouseLeave={(e) => hover(e, false)}
        style={{ ...iconBtn, marginRight: 8 }}
        aria-label="Toggle sidebar"
      >
        <PanelLeft style={{ width: 15, height: 15 }} />
      </button>

      {/* Cortex title */}
      <span
        style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', fontFamily: '"JetBrains Mono", monospace' }}
        data-tauri-drag-region
      >
        {'Cortex'.split('').map((ch, i) => (
          <span key={i} style={{ color: colors[i] }}>{ch}</span>
        ))}
      </span>

      {/* Spacer */}
      <div style={{ flex: 1 }} data-tauri-drag-region />

      {/* Theme toggle pill */}
      <div
        onClick={(e) => { e.stopPropagation(); setTheme(isDark ? "light" : "dark"); }}
        style={{
          display: 'flex', alignItems: 'center', position: 'relative',
          width: 52, height: 26, borderRadius: 13,
          background: isDark ? 'var(--muted-strong)' : 'rgba(0,0,0,0.08)',
          border: '1px solid var(--border)',
          cursor: 'pointer', transition: 'background 200ms',
          padding: 2,
        }}
        role="button"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {/* Sun icon */}
        <Sun style={{
          width: 12, height: 12, position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)',
          color: isDark ? 'var(--text-muted)' : '#d97706',
          transition: 'color 200ms',
        }} />
        {/* Moon icon */}
        <Moon style={{
          width: 12, height: 12, position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
          color: isDark ? '#93c5fd' : 'var(--text-muted)',
          transition: 'color 200ms',
        }} />
        {/* Sliding indicator */}
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          background: isDark
            ? 'linear-gradient(135deg, #1e3a5f, #2563eb)'
            : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
          boxShadow: isDark
            ? '0 1px 4px rgba(37,99,235,0.4)'
            : '0 1px 4px rgba(245,158,11,0.4)',
          transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1), background 250ms, box-shadow 250ms',
          transform: isDark ? 'translateX(26px)' : 'translateX(0px)',
        }} />
      </div>
    </div>
  );
}
