import { useCallback } from "react";
import { Settings, FolderOpen } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useVaultStore } from "@/stores/vaultStore";

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

const checkboxRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
};

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Settings size={18} style={{ color: 'var(--accent)' }} />
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          General
        </h3>
      </div>

      {/* Vault path */}
      <div style={sectionCard}>
        <label style={sectionLabel}>Vault Location</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              flex: 1,
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              fontSize: 12,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: '"JetBrains Mono", "SF Mono", monospace',
            }}
          >
            {vaultPath || "No vault selected"}
          </div>
          <button
            onClick={handleChangeVault}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              fontSize: 12,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 150ms',
            }}
          >
            <FolderOpen size={14} />
            Change Vault
          </button>
        </div>
      </div>

      {/* Toggles */}
      <div style={sectionCard}>
        <label style={sectionLabel}>Editor</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={checkboxRow}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Auto-save</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Save after 1 second of inactivity
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
          </label>

          <label style={checkboxRow}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Spell Check</span>
            <input
              type="checkbox"
              checked={spellCheck}
              onChange={(e) => setSpellCheck(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
          </label>

          <label style={checkboxRow}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Line Numbers</span>
            <input
              type="checkbox"
              checked={editorLineNumbers}
              onChange={(e) => setEditorLineNumbers(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
          </label>

          <label style={checkboxRow}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Word Wrap</span>
            <input
              type="checkbox"
              checked={editorWordWrap}
              onChange={(e) => setEditorWordWrap(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
          </label>
        </div>
      </div>

      {/* Default template selector */}
      <div style={sectionCard}>
        <label style={sectionLabel}>Default New Note Template</label>
        <select
          defaultValue="blank"
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
          <option value="blank">Blank Note</option>
          <option value="daily">Daily Note</option>
          <option value="meeting">Meeting Notes</option>
        </select>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Templates can be managed in the Templates section of the sidebar
        </p>
      </div>
    </div>
  );
}
