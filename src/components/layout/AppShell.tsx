import { useEffect, useState } from "react";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { useVaultStore } from "@/stores/vaultStore";
import { useEditorStore } from "@/stores/editorStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useFileWatcher } from "@/hooks/useFileWatcher";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { QuickSwitcher } from "@/components/command-palette/QuickSwitcher";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { GraphView } from "@/components/graph/GraphView";
import { SplitView } from "@/components/editor/SplitView";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { commandRegistry } from "@/lib/commandRegistry";
import { invoke } from "@tauri-apps/api/core";
import { useVoice } from "@/hooks/useVoice";
import { RecordingOverlay } from "@/components/voice/RecordingOverlay";

export function AppShell() {
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useFileWatcher();
  const voice = useVoice();
  useKeyboardShortcuts({
    onOpenQuickSwitcher: () => setQuickSwitcherOpen(true),
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    onToggleGraph: () => setGraphFullscreen((v) => !v),
    onOpenSettings: () => setSettingsOpen(true),
  });

  // Apply theme and font settings on mount
  useEffect(() => {
    useSettingsStore.getState().applyAllSettings();
  }, []);

  // Register commands on mount
  useEffect(() => {
    const openVault = useVaultStore.getState().openVault;
    const createNote = useVaultStore.getState().createNote;
    const setActiveFile = useVaultStore.getState().setActiveFile;

    commandRegistry.register({
      id: "open-vault",
      label: "Open Vault",
      category: "File",
      shortcut: "Cmd+O",
      action: () => openVault(),
    });

    commandRegistry.register({
      id: "new-note",
      label: "New Note",
      category: "File",
      shortcut: "Cmd+N",
      action: () => {
        const vaultPath = useVaultStore.getState().vaultPath;
        if (!vaultPath) return;
        const title = window.prompt("Note name:");
        if (!title) return;
        createNote(title).then((path) => {
          setActiveFile(path);
          useEditorStore.getState().openTab(path, "");
        });
      },
    });

    commandRegistry.register({
      id: "save-note",
      label: "Save Note",
      category: "File",
      shortcut: "Cmd+S",
      action: () => {
        const tab = useEditorStore.getState().getActiveTab();
        if (!tab) return;
        invoke("save_note", { path: tab.filePath, content: tab.content })
          .then(() => {
            useEditorStore.getState().markSaved(tab.id, tab.content);
          })
          .catch((err) => {
            console.warn("[Cortex] save_note failed:", err);
          });
      },
    });

    commandRegistry.register({
      id: "close-tab",
      label: "Close Tab",
      category: "File",
      shortcut: "Cmd+W",
      action: () => {
        const state = useEditorStore.getState();
        const pane = state.panes[state.activePaneIndex];
        if (pane?.activeTabId) {
          state.closeTab(pane.activeTabId);
        }
      },
    });

    commandRegistry.register({
      id: "quick-switcher",
      label: "Quick Switcher",
      category: "Navigation",
      shortcut: "Cmd+O",
      action: () => setQuickSwitcherOpen(true),
    });

    commandRegistry.register({
      id: "toggle-sidebar",
      label: "Toggle Sidebar",
      category: "View",
      shortcut: "Cmd+B",
      action: () => useSettingsStore.getState().toggleSidebar(),
    });

    commandRegistry.register({
      id: "split-horizontal",
      label: "Split Editor Horizontally",
      category: "View",
      shortcut: "Cmd+\\",
      action: () => {
        const current = useEditorStore.getState().splitDirection;
        useEditorStore
          .getState()
          .setSplit(current === "horizontal" ? "none" : "horizontal");
      },
    });

    commandRegistry.register({
      id: "split-vertical",
      label: "Split Editor Vertically",
      category: "View",
      action: () => {
        const current = useEditorStore.getState().splitDirection;
        useEditorStore
          .getState()
          .setSplit(current === "vertical" ? "none" : "vertical");
      },
    });

    commandRegistry.register({
      id: "close-split",
      label: "Close Split",
      category: "View",
      action: () => useEditorStore.getState().setSplit("none"),
    });

    commandRegistry.register({
      id: "open-graph",
      label: "Open Knowledge Graph",
      category: "View",
      shortcut: "Cmd+G",
      action: () => setGraphFullscreen((v) => !v),
    });

    commandRegistry.register({
      id: "daily-note",
      label: "Open Today's Daily Note",
      category: "Notes",
      shortcut: "Cmd+D",
      action: () => {
        // Delegates to daily notes (Team 4D)
        console.log("[Cortex] Open daily note");
      },
    });

    commandRegistry.register({
      id: "toggle-theme",
      label: "Toggle Dark/Light Theme",
      category: "Appearance",
      action: () => {
        const current = useSettingsStore.getState().theme;
        useSettingsStore
          .getState()
          .setTheme(current === "dark" ? "light" : "dark");
      },
    });

    commandRegistry.register({
      id: "search-vault",
      label: "Search Vault",
      category: "Search",
      shortcut: "Cmd+Shift+F",
      action: () => {
        console.log("[Cortex] Focus search panel");
      },
    });

    commandRegistry.register({
      id: "command-palette",
      label: "Command Palette",
      category: "Navigation",
      shortcut: "Cmd+P",
      action: () => setCommandPaletteOpen(true),
    });

    commandRegistry.register({
      id: "open-settings",
      label: "Open Settings",
      category: "Navigation",
      shortcut: "Cmd+,",
      action: () => setSettingsOpen(true),
    });

    return () => {
      const ids = [
        "open-vault",
        "new-note",
        "save-note",
        "close-tab",
        "quick-switcher",
        "toggle-sidebar",
        "split-horizontal",
        "split-vertical",
        "close-split",
        "open-graph",
        "daily-note",
        "toggle-theme",
        "search-vault",
        "command-palette",
        "open-settings",
      ];
      ids.forEach((id) => commandRegistry.unregister(id));
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        {graphFullscreen ? (
          <div className="flex-1 min-w-0 relative">
            <GraphView />
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-w-0">
            {(voice.isRecording || voice.isTranscribing) && (
              <RecordingOverlay />
            )}
            <SplitView />
          </div>
        )}
      </div>
      <StatusBar />
      <QuickSwitcher
        isOpen={quickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
      />
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
