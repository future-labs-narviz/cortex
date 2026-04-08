import { useCallback } from "react";
import { Palette, RotateCcw } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";

const FONT_OPTIONS = [
  { value: "system", label: "System Default" },
  { value: "jetbrains", label: "JetBrains Mono" },
  { value: "fira", label: "Fira Code" },
  { value: "inter", label: "Inter" },
];

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

  const handleResetDefaults = useCallback(() => {
    setTheme("dark");
    setFontFamily("system");
    setFontSize(14);
    setLineHeight(1.6);
    setSidebarWidth(250);
    setCustomCSS("");
  }, [setTheme, setFontFamily, setFontSize, setLineHeight, setSidebarWidth, setCustomCSS]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 mb-1">
        <Palette size={18} className="text-[var(--accent)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Appearance
        </h3>
      </div>

      {/* Theme toggle */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <label className="text-sm font-semibold text-[var(--text-primary)] mb-3 block">Theme</label>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme("dark")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-[var(--radius-xl)] text-sm border transition-colors duration-150 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 ${
              theme === "dark"
                ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]"
                : "bg-[var(--muted)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]"
            }`}
          >
            <span
              className="w-4 h-4 rounded-full border border-[var(--border)] bg-[#0f1117]"
            />
            Dark
          </button>
          <button
            onClick={() => setTheme("light")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-[var(--radius-xl)] text-sm border transition-colors duration-150 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 ${
              theme === "light"
                ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]"
                : "bg-[var(--muted)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]"
            }`}
          >
            <span
              className="w-4 h-4 rounded-full border border-[var(--border)] bg-[#f8f9fa]"
            />
            Light
          </button>
        </div>
      </div>

      {/* Font family */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <label className="text-sm font-semibold text-[var(--text-primary)] mb-3 block">Font Family</label>
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          className="w-full h-9 px-3 text-sm rounded-[var(--radius-lg)] bg-[var(--muted)] border border-[var(--border)] text-[var(--text-primary)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 transition-colors duration-150 ease-in-out"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Font size & Line height & Sidebar width */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <label className="text-sm font-semibold text-[var(--text-primary)] mb-3 block">Layout</label>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[var(--text-secondary)]">
              Font Size: {fontSize}px
            </label>
            <input
              type="range"
              min={12}
              max={20}
              step={1}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-[var(--accent)] cursor-pointer"
            />
            <div className="flex justify-between text-xs text-[var(--text-muted)]">
              <span>12px</span>
              <span>20px</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[var(--text-secondary)]">
              Editor Line Height: {lineHeight.toFixed(1)}
            </label>
            <input
              type="range"
              min={1.4}
              max={2.0}
              step={0.1}
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              className="w-full accent-[var(--accent)] cursor-pointer"
            />
            <div className="flex justify-between text-xs text-[var(--text-muted)]">
              <span>1.4</span>
              <span>2.0</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[var(--text-secondary)]">
              Sidebar Width: {sidebarWidth}px
            </label>
            <input
              type="range"
              min={200}
              max={400}
              step={10}
              value={sidebarWidth}
              onChange={(e) => setSidebarWidth(Number(e.target.value))}
              className="w-full accent-[var(--accent)] cursor-pointer"
            />
            <div className="flex justify-between text-xs text-[var(--text-muted)]">
              <span>200px</span>
              <span>400px</span>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <label className="text-sm font-semibold text-[var(--text-primary)] mb-3 block">Custom CSS</label>
        <textarea
          value={customCSS}
          onChange={(e) => setCustomCSS(e.target.value)}
          placeholder="/* Add custom CSS overrides here */"
          rows={5}
          spellCheck={false}
          className="w-full px-3 py-2 text-xs rounded-[var(--radius-lg)] bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 transition-colors duration-150 ease-in-out"
        />
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Custom styles saved to .cortex/custom.css
        </p>
      </div>

      {/* Reset */}
      <button
        onClick={handleResetDefaults}
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-[var(--radius-lg)] text-sm bg-[var(--muted)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--red)] hover:text-[var(--red)] transition-colors duration-150 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
      >
        <RotateCcw size={14} />
        Reset to Defaults
      </button>
    </div>
  );
}
