import { useCallback } from "react";
import { Settings, FolderOpen } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useVaultStore } from "@/stores/vaultStore";

export function GeneralSettings() {
  const vaultPath = useVaultStore((s) => s.vaultPath);
  const openVault = useVaultStore((s) => s.openVault);
  const {
    autoSave,
    spellCheck,
    editorLineNumbers,
    editorWordWrap,
    setAutoSave,
    setSpellCheck,
    setEditorLineNumbers,
    setEditorWordWrap,
  } = useSettingsStore();

  const handleChangeVault = useCallback(() => {
    openVault();
  }, [openVault]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 mb-1">
        <Settings size={18} className="text-[var(--accent)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          General
        </h3>
      </div>

      {/* Vault path */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <label className="text-sm font-semibold text-[var(--text-primary)] mb-3 block">Vault Location</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2 text-xs rounded-[var(--radius-lg)] bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] truncate font-mono">
            {vaultPath || "No vault selected"}
          </div>
          <button
            onClick={handleChangeVault}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-[var(--radius-lg)] bg-[var(--muted)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors duration-150 ease-in-out cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
          >
            <FolderOpen size={14} />
            Change Vault
          </button>
        </div>
      </div>

      {/* Toggles */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <label className="text-sm font-semibold text-[var(--text-primary)] mb-3 block">Editor</label>
        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex flex-col">
              <span className="text-sm text-[var(--text-secondary)]">Auto-save</span>
              <span className="text-xs text-[var(--text-muted)]">
                Save after 1 second of inactivity
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              className="w-4 h-4 accent-[var(--accent)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[var(--text-secondary)]">Spell Check</span>
            <input
              type="checkbox"
              checked={spellCheck}
              onChange={(e) => setSpellCheck(e.target.checked)}
              className="w-4 h-4 accent-[var(--accent)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[var(--text-secondary)]">Line Numbers</span>
            <input
              type="checkbox"
              checked={editorLineNumbers}
              onChange={(e) => setEditorLineNumbers(e.target.checked)}
              className="w-4 h-4 accent-[var(--accent)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[var(--text-secondary)]">Word Wrap</span>
            <input
              type="checkbox"
              checked={editorWordWrap}
              onChange={(e) => setEditorWordWrap(e.target.checked)}
              className="w-4 h-4 accent-[var(--accent)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
            />
          </label>
        </div>
      </div>

      {/* Default template selector */}
      <div className="bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-xl)] p-4">
        <label className="text-sm font-semibold text-[var(--text-primary)] mb-3 block">
          Default New Note Template
        </label>
        <select
          defaultValue="blank"
          className="w-full h-9 px-3 text-sm rounded-[var(--radius-lg)] bg-[var(--muted)] border border-[var(--border)] text-[var(--text-primary)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 transition-colors duration-150 ease-in-out"
        >
          <option value="blank">Blank Note</option>
          <option value="daily">Daily Note</option>
          <option value="meeting">Meeting Notes</option>
        </select>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Templates can be managed in the Templates section of the sidebar
        </p>
      </div>
    </div>
  );
}
