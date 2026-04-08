import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "@/stores/vaultStore";
import { Link2 } from "lucide-react";

interface Backlink {
  source_path: string;
  source_title: string;
  context: string;
  line: number;
}

const emptyState: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  textAlign: 'center',
  paddingLeft: 24,
  paddingRight: 24,
};

export function BacklinksPanel() {
  const activeFilePath = useVaultStore((s) => s.activeFilePath);
  const setActiveFile = useVaultStore((s) => s.setActiveFile);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBacklinks = useCallback(async () => {
    if (!activeFilePath) {
      setBacklinks([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await invoke<Backlink[]>("get_backlinks", {
        notePath: activeFilePath,
      });
      setBacklinks(result);
    } catch (e) {
      console.warn("[Cortex] get_backlinks not available:", e);
      setError("Backlinks not available");
      setBacklinks([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilePath]);

  useEffect(() => {
    fetchBacklinks();
  }, [fetchBacklinks]);

  if (!activeFilePath) {
    return (
      <div style={emptyState}>
        <Link2 style={{ width: 20, height: 20, color: 'var(--text-muted)', marginBottom: 12 }} />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Select a note to see its backlinks.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={emptyState}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading backlinks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={emptyState}>
        <Link2 style={{ width: 20, height: 20, color: 'var(--text-muted)', marginBottom: 12 }} />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{error}</p>
      </div>
    );
  }

  if (backlinks.length === 0) {
    return (
      <div style={emptyState}>
        <Link2 style={{ width: 20, height: 20, color: 'var(--text-muted)', marginBottom: 12 }} />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          No backlinks found for this note.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: 'var(--text-muted)',
          marginBottom: 8,
        }}
      >
        <span>Backlinks</span>
        <span
          style={{
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 2,
            paddingBottom: 2,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--muted)',
            fontSize: 10,
            color: 'var(--text-muted)',
            fontWeight: 500,
          }}
        >
          {backlinks.length}
        </span>
      </p>
      {backlinks.map((bl, idx) => (
        <BacklinkItem
          key={`${bl.source_path}-${bl.line}-${idx}`}
          backlink={bl}
          onNavigate={setActiveFile}
          isLast={idx === backlinks.length - 1}
        />
      ))}
    </div>
  );
}

function BacklinkItem({
  backlink,
  onNavigate,
  isLast,
}: {
  backlink: Backlink;
  onNavigate: (path: string) => void;
  isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => onNavigate(backlink.source_path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        width: '100%',
        textAlign: 'left',
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        borderRadius: 'var(--radius-md)',
        background: hovered ? 'var(--muted)' : 'transparent',
        transition: 'background 150ms',
        cursor: 'pointer',
        border: 'none',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--accent)',
          textDecoration: hovered ? 'underline' : 'none',
        }}
      >
        {backlink.source_title}
      </span>
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        <HighlightedContext context={backlink.context} />
      </span>
    </button>
  );
}

function HighlightedContext({ context }: { context: string }) {
  if (!context) return null;

  const parts = context.split(/(\[\[[^\]]+\]\])/g);

  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("[[") && part.endsWith("]]") ? (
          <span key={i} style={{ color: 'var(--accent)', fontWeight: 500 }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
