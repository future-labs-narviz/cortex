import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { invoke } from "@tauri-apps/api/core";
import { editorApi } from "@/lib/editorApi";

interface KeyboardShortcutOptions {
  onOpenQuickSwitcher?: () => void;
  onOpenCommandPalette?: () => void;
  onToggleGraph?: () => void;
  onOpenSettings?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutOptions = {}) {
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const openVault = useVaultStore((s) => s.openVault);
  const createNote = useVaultStore((s) => s.createNote);
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const setActiveFile = useVaultStore((s) => s.setActiveFile);
  const openTab = useEditorStore((s) => s.openTab);
  const getActiveTab = useEditorStore((s) => s.getActiveTab);
  const markSaved = useEditorStore((s) => s.markSaved);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+P: Command palette
      if (mod && e.key === "p") {
        e.preventDefault();
        if (options.onOpenCommandPalette) {
          options.onOpenCommandPalette();
        }
        return;
      }

      // Cmd+O: Open quick switcher (if vault open) or open vault
      if (mod && e.key === "o") {
        e.preventDefault();
        if (vaultPath && options.onOpenQuickSwitcher) {
          options.onOpenQuickSwitcher();
        } else {
          openVault();
        }
        return;
      }

      // Cmd+N: Create new note
      if (mod && e.key === "n") {
        e.preventDefault();
        if (!vaultPath) {
          console.log("[Cortex] No vault open, cannot create note");
          return;
        }
        const title = window.prompt("Note name:");
        if (!title) return;
        createNote(title).then((path) => {
          setActiveFile(path);
          openTab(path, "");
        });
        return;
      }

      // Cmd+S: Save current note
      if (mod && e.key === "s") {
        e.preventDefault();
        const tab = getActiveTab();
        if (!tab) return;
        invoke("save_note", { path: tab.filePath, content: tab.content })
          .then(() => {
            markSaved(tab.id, tab.content);
          })
          .catch((err) => {
            console.warn("[Cortex] save_note failed:", err);
          });
        return;
      }

      // Cmd+B: Toggle sidebar
      if (mod && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Cmd+W: Close active tab
      if (mod && e.key === "w") {
        e.preventDefault();
        const state = useEditorStore.getState();
        const pane = state.panes[state.activePaneIndex];
        if (pane?.activeTabId) {
          state.closeTab(pane.activeTabId);
        }
        return;
      }

      // Cmd+\: Toggle horizontal split
      if (mod && e.key === "\\") {
        e.preventDefault();
        const state = useEditorStore.getState();
        state.setSplit(
          state.splitDirection === "horizontal" ? "none" : "horizontal",
        );
        return;
      }

      // Cmd+G: Toggle graph view (fullscreen)
      if (mod && e.key === "g") {
        e.preventDefault();
        if (options.onToggleGraph) {
          options.onToggleGraph();
        }
        return;
      }

      // Cmd+Shift+R: Toggle voice recording
      if (mod && e.shiftKey && e.key === "R") {
        e.preventDefault();
        const voiceState = useVoiceStore.getState();
        if (voiceState.isRecording) {
          voiceState.stopRecording().then((text) => {
            if (text) {
              editorApi.insertAtCursor(text);
            }
          });
        } else if (!voiceState.isTranscribing) {
          voiceState.startRecording();
        }
        return;
      }

      // Cmd+,: Open settings
      if (mod && e.key === ",") {
        e.preventDefault();
        if (options.onOpenSettings) {
          options.onOpenSettings();
        }
        return;
      }

      // Cmd+D: Open/create daily note
      if (mod && e.key === "d") {
        e.preventDefault();
        if (!vaultPath) return;
        invoke<string>("create_daily_note")
          .then((path) => {
            setActiveFile(path);
            openTab(path, "");
          })
          .catch((err) => {
            console.warn("[Cortex] create_daily_note failed:", err);
          });
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    toggleSidebar,
    openVault,
    createNote,
    vaultPath,
    setActiveFile,
    openTab,
    getActiveTab,
    markSaved,
    options,
  ]);
}
