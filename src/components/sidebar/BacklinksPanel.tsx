import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVaultStore } from "@/stores/vaultStore";
import { Link2, FileText, ChevronDown, ChevronRight } from "lucide-react";

interface Backlink {
  source_path: string;
  source_title: string;
  context: string;
  line: number;
}

export function BacklinksPanel() {
  const activeFilePath = useVaultStore((s) => s.activeFilePath);
  const setActiveFile = useVaultStore((s) => s.setActiveFile);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedOpen, setLinkedOpen] = useState(true);

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

  // Derive the current note name for the header
  const currentNoteName = activeFilePath
    ? activeFilePath.replace(/\.md$/, "").split("/").pop() ?? ""
    : "";

  if (!activeFilePath) {
    return <BacklinksEmptyState message="Select a note to see its backlinks." />;
  }

  if (loading) {
    return <BacklinksEmptyState message="Loading backlinks..." />;
  }

  if (error) {
    return <BacklinksEmptyState message={error} />;
  }

  if (backlinks.length === 0) {
    return <BacklinksEmptyState message="No backlinks found for this note." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Current note indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingBottom: 8,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Link2 size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
        <span
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Backlinks for{" "}
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            {currentNoteName}
          </span>
        </span>
      </div>

      {/* Linked mentions section */}
      <SectionHeader
        title="Linked mentions"
        count={backlinks.length}
        isOpen={linkedOpen}
        onToggle={() => setLinkedOpen((v) => !v)}
      />

      {linkedOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {backlinks.map((bl, idx) => (
            <BacklinkCard
              key={`${bl.source_path}-${bl.line}-${idx}`}
              backlink={bl}
              onNavigate={setActiveFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  count,
  isOpen,
  onToggle,
}: {
  title: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        padding: "4px 0",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: hovered ? "var(--text-primary)" : "var(--text-secondary)",
        transition: "color 150ms",
        textAlign: "left",
      }}
    >
      {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontFamily: '"JetBrains Mono", "SF Mono", monospace',
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          fontFamily: '"JetBrains Mono", monospace',
          background: "var(--muted)",
          paddingLeft: 5,
          paddingRight: 5,
          paddingTop: 1,
          paddingBottom: 1,
          borderRadius: 4,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function BacklinkCard({
  backlink,
  onNavigate,
}: {
  backlink: Backlink;
  onNavigate: (path: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  // Extract folder path for breadcrumb
  const folderPath = backlink.source_path.includes("/")
    ? backlink.source_path.replace(/\/[^/]+$/, "")
    : "";

  return (
    <button
      onClick={() => onNavigate(backlink.source_path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
        textAlign: "left",
        padding: 10,
        borderRadius: 8,
        background: hovered ? "var(--muted-hover)" : "var(--muted)",
        border: "1px solid var(--border)",
        transition: "all 150ms",
        cursor: "pointer",
      }}
    >
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <FileText
          size={14}
          style={{
            flexShrink: 0,
            color: hovered ? "var(--accent)" : "var(--text-muted)",
            transition: "color 150ms",
          }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--accent)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            textDecoration: hovered ? "underline" : "none",
          }}
        >
          {backlink.source_title}
        </span>
        {/* Line number badge */}
        <span
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            fontFamily: '"JetBrains Mono", monospace',
            background: "var(--bg-tertiary)",
            paddingLeft: 5,
            paddingRight: 5,
            paddingTop: 1,
            paddingBottom: 1,
            borderRadius: 3,
            flexShrink: 0,
          }}
        >
          L{backlink.line}
        </span>
      </div>

      {/* Folder breadcrumb */}
      {folderPath && (
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: '"JetBrains Mono", "SF Mono", monospace',
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            paddingLeft: 20,
          }}
        >
          {folderPath}
        </span>
      )}

      {/* Context snippet */}
      {backlink.context && (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            paddingLeft: 20,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          <HighlightedContext context={backlink.context} />
        </div>
      )}
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
          <span
            key={i}
            style={{
              color: "var(--accent)",
              fontWeight: 500,
              background: "rgba(59, 130, 246, 0.08)",
              borderRadius: 3,
              padding: "0 2px",
            }}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function BacklinksEmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 200,
        textAlign: "center",
        paddingLeft: 24,
        paddingRight: 24,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "var(--radius-xl)",
          background: "var(--muted)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Link2 style={{ width: 20, height: 20, color: "var(--text-muted)" }} />
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
        {message}
      </p>
    </div>
  );
}
