import { useState } from "react";
import { PanelLeft, Sun, Moon } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Builds a stacked text-shadow string that simulates a chiseled 3D extrusion.
 * Layers a series of 1px offsets along a 45° axis, fading from a near-black
 * blue at the front to a deep midnight at the back, then closes with a tight
 * contact shadow and an ambient blue glow.
 */
function build3DShadow(isDark: boolean): string {
  // Subtle 3-layer extrusion — just enough depth to feel sculpted, not loud.
  const startColor = isDark ? [30, 41, 59] : [15, 23, 42];
  const endColor = isDark ? [8, 12, 28] : [2, 6, 23];

  const layers: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const t = (i - 1) / 2;
    const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * t);
    const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * t);
    const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * t);
    layers.push(`${i}px ${i}px 0 rgb(${r}, ${g}, ${b})`);
  }

  const contact = isDark
    ? "3px 4px 6px rgba(0, 0, 0, 0.35)"
    : "3px 4px 6px rgba(15, 23, 42, 0.18)";

  return [...layers, contact].join(", ");
}

export function TitleBar() {
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const isDark = theme === "dark";
  const [titleHover, setTitleHover] = useState(false);

  // Subtle top-down gradient: white highlight → blue body → deep navy base
  const titleGradient = isDark
    ? "linear-gradient(180deg, #f1f5f9 0%, #93c5fd 35%, #3b82f6 70%, #1e40af 100%)"
    : "linear-gradient(180deg, #f8fafc 0%, #60a5fa 35%, #2563eb 70%, #1e3a8a 100%)";

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
        paddingLeft: 16, paddingRight: 12,
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
        style={{ ...iconBtn, marginRight: 12 }}
        aria-label="Toggle sidebar"
      >
        <PanelLeft style={{ width: 15, height: 15 }} />
      </button>

      {/* Cortex 3D title */}
      <div
        onMouseEnter={() => setTitleHover(true)}
        onMouseLeave={() => setTitleHover(false)}
        style={{
          position: 'relative',
          display: 'inline-block',
          paddingLeft: 2,
          paddingRight: 10,
          paddingTop: 1,
          paddingBottom: 4,
          cursor: 'default',
          isolation: 'isolate',
        }}
        data-tauri-drag-region
      >
        {/* Shadow layer (extrusion + glow), absolutely positioned BEHIND the foreground */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 2,
            top: 1,
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: '0.01em',
            lineHeight: 1,
            color: isDark ? '#0b1220' : '#0c1a3d',
            textShadow: build3DShadow(isDark),
            zIndex: 0,
            userSelect: 'none',
            pointerEvents: 'none',
            transform: titleHover ? 'translate(0px, 1px)' : 'translate(0, 0)',
            transition: 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          Cortex
        </span>

        {/* Foreground: gradient-filled glyphs (the lit face of the 3D extrusion) */}
        <span
          aria-label="Cortex"
          style={{
            position: 'relative',
            display: 'inline-block',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: '0.01em',
            lineHeight: 1,
            background: titleGradient,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            filter: isDark
              ? 'drop-shadow(0 1px 0 rgba(255,255,255,0.18))'
              : 'drop-shadow(0 1px 0 rgba(255,255,255,0.7))',
            transform: titleHover ? 'translate(-1px, -1px)' : 'translate(0, 0)',
            transition: 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 1,
            userSelect: 'none',
          }}
        >
          Cortex
        </span>
      </div>

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
