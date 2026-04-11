import { useEffect, useState } from "react";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { LayoutRoot } from "./LayoutRoot";
import { useVaultStore } from "@/stores/vaultStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useFileWatcher } from "@/hooks/useFileWatcher";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { QuickSwitcher } from "@/components/command-palette/QuickSwitcher";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { commandRegistry } from "@/lib/commandRegistry";
import { invoke } from "@tauri-apps/api/core";
import { useVoice } from "@/hooks/useVoice";
import { RecordingOverlay } from "@/components/voice/RecordingOverlay";

export function AppShell() {
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useFileWatcher();
  const voice = useVoice();
  useKeyboardShortcuts({
    onOpenQuickSwitcher: () => setQuickSwitcherOpen(true),
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    onOpenSettings: () => setSettingsOpen(true),
  });

  // Apply theme and font settings on mount
  useEffect(() => {
    useSettingsStore.getState().applyAllSettings();
  }, []);

  // Auto-reopen last vault on mount.
  //
  // IMPORTANT: flip `isVaultOpen: true` only AFTER the backend
  // `open_vault` command has returned successfully. Previously this
  // effect set `isVaultOpen: true` synchronously and then kicked off
  // `invoke("open_vault", ...)` in the background, which let the
  // layoutStore's rehydrated sheets (e.g. a plan-runner restored from
  // a previous session) mount and issue `read_note` calls against a
  // backend that hadn't yet opened the vault. Symptom: "Failed to
  // load plan: No vault is currently open" flash on first launch,
  // which only disappeared after a manual reload because the second
  // attempt saw a vault state.
  useEffect(() => {
    const savedPath = localStorage.getItem("cortex-vault-path");
    if (savedPath && !useVaultStore.getState().isVaultOpen) {
      // Set the path but NOT isVaultOpen yet — children still see a
      // NoVaultState until the backend is ready.
      useVaultStore.setState({ vaultPath: savedPath });
      invoke("open_vault", { path: savedPath })
        .then(() => {
          useVaultStore.setState({ isVaultOpen: true });
          useVaultStore.getState().refreshFiles();
        })
        .catch(() => {
          localStorage.removeItem("cortex-vault-path");
          useVaultStore.setState({ vaultPath: null, isVaultOpen: false });
        });
    }
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
        const now = new Date();
        const title = `Untitled ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
        createNote(title).then((path) => {
          setActiveFile(path);
          useLayoutStore.getState().openTab(path, "");
        });
      },
    });

    commandRegistry.register({
      id: "save-note",
      label: "Save Note",
      category: "File",
      shortcut: "Cmd+S",
      action: () => {
        const tab = useLayoutStore.getState().getActiveTab();
        if (!tab) return;
        invoke("save_note", { path: tab.filePath, content: tab.content })
          .then(() => {
            useLayoutStore.getState().markSaved(tab.id, tab.content);
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
        const layout = useLayoutStore.getState();
        const sheet = layout.sheets[layout.activeSheetId];
        if (sheet?.activeTabId) {
          layout.closeTab(layout.activeSheetId, sheet.activeTabId);
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
      label: "Split Sheet Horizontally",
      category: "View",
      shortcut: "Cmd+\\",
      action: () => {
        const layout = useLayoutStore.getState();
        layout.splitSheet(layout.activeSheetId, "horizontal");
      },
    });

    commandRegistry.register({
      id: "split-vertical",
      label: "Split Sheet Vertically",
      category: "View",
      shortcut: "Cmd+Shift+\\",
      action: () => {
        const layout = useLayoutStore.getState();
        layout.splitSheet(layout.activeSheetId, "vertical");
      },
    });

    commandRegistry.register({
      id: "close-sheet",
      label: "Close Sheet",
      category: "View",
      shortcut: "Cmd+Shift+W",
      action: () => {
        const layout = useLayoutStore.getState();
        layout.closeSheet(layout.activeSheetId);
      },
    });

    commandRegistry.register({
      id: "open-graph",
      label: "Open Knowledge Graph",
      category: "View",
      shortcut: "Cmd+G",
      action: () => {
        const layout = useLayoutStore.getState();
        layout.setSheetContent(layout.activeSheetId, { kind: "graph" });
      },
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
        "close-sheet",
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
        <div className="flex flex-col flex-1 min-w-0" style={{ padding: "var(--sheet-gap, 8px)", paddingLeft: 0 }}>
          {(voice.isRecording || voice.isTranscribing) && (
            <RecordingOverlay />
          )}
          <LayoutRoot />
        </div>
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
