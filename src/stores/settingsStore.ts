import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme } from "@/lib/types";
import { getThemeTokens } from "@/themes/tokens";
import { applyTheme, applyCustomCSS, applyFontSettings } from "@/themes/applyTheme";

interface SettingsStore {
  theme: Theme;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  editorWordWrap: boolean;
  editorLineNumbers: boolean;
  autoSave: boolean;
  spellCheck: boolean;
  customCSS: string;

  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setTheme: (theme: Theme) => void;
  setFontFamily: (f: string) => void;
  setFontSize: (s: number) => void;
  setLineHeight: (h: number) => void;
  setEditorWordWrap: (v: boolean) => void;
  setEditorLineNumbers: (v: boolean) => void;
  setAutoSave: (v: boolean) => void;
  setSpellCheck: (v: boolean) => void;
  setCustomCSS: (css: string) => void;
  applyAllSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      theme: "dark",
      sidebarWidth: 300,
      sidebarCollapsed: false,
      fontFamily: "system",
      fontSize: 14,
      lineHeight: 1.6,
      editorWordWrap: true,
      editorLineNumbers: false,
      autoSave: true,
      spellCheck: false,
      customCSS: "",

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarWidth: (width: number) => {
        set({ sidebarWidth: width });
      },

      setTheme: (theme: Theme) => {
        set({ theme });
        applyTheme(getThemeTokens(theme));
      },

      setFontFamily: (fontFamily: string) => {
        set({ fontFamily });
        const s = get();
        applyFontSettings(fontFamily, s.fontSize, s.lineHeight);
      },

      setFontSize: (fontSize: number) => {
        set({ fontSize });
        const s = get();
        applyFontSettings(s.fontFamily, fontSize, s.lineHeight);
      },

      setLineHeight: (lineHeight: number) => {
        set({ lineHeight });
        const s = get();
        applyFontSettings(s.fontFamily, s.fontSize, lineHeight);
      },

      setEditorWordWrap: (editorWordWrap: boolean) => set({ editorWordWrap }),
      setEditorLineNumbers: (editorLineNumbers: boolean) => set({ editorLineNumbers }),
      setAutoSave: (autoSave: boolean) => set({ autoSave }),
      setSpellCheck: (spellCheck: boolean) => set({ spellCheck }),

      setCustomCSS: (customCSS: string) => {
        set({ customCSS });
        applyCustomCSS(customCSS);
      },

      applyAllSettings: () => {
        const s = get();
        applyTheme(getThemeTokens(s.theme));
        applyFontSettings(s.fontFamily, s.fontSize, s.lineHeight);
        applyCustomCSS(s.customCSS);
      },
    }),
    {
      name: "cortex-settings",
      partialize: (state) => ({
        theme: state.theme,
        sidebarWidth: state.sidebarWidth,
        fontFamily: state.fontFamily,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        editorWordWrap: state.editorWordWrap,
        editorLineNumbers: state.editorLineNumbers,
        autoSave: state.autoSave,
        spellCheck: state.spellCheck,
        customCSS: state.customCSS,
      }),
    },
  ),
);
