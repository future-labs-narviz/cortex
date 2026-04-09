import { useState } from "react";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
import type { KgEntityProfile, EntityType } from "@/lib/types";

interface EntityProfilePanelProps {
  profile: KgEntityProfile;
  onClose: () => void;
  onNavigateToEntity: (name: string) => void;
}

const TYPE_COLORS: Record<EntityType, string> = {
  Person: "var(--accent)",
  Project: "var(--purple)",
  Technology: "var(--cyan)",
  Decision: "var(--orange)",
  Pattern: "var(--green)",
  Organization: "var(--yellow)",
  Concept: "var(--text-muted)",
};

export function EntityProfilePanel({
  profile,
  onClose,
  onNavigateToEntity,
}: EntityProfilePanelProps) {
  const [closeHovered, setCloseHovered] = useState(false);

  const { entity, relations_out, relations_in, mention_count } = profile;

  // Compute unique related entity names from relations
  const relatedNames = new Set<string>();
  for (const r of relations_out) relatedNames.add(r.target);
  for (const r of relations_in) relatedNames.add(r.source);
  relatedNames.delete(entity.name);

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        height: "100%",
        background: "var(--bg-secondary)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 6,
              wordBreak: "break-word",
            }}
          >
            {entity.name}
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "2px 8px",
              borderRadius: 999,
              background: TYPE_COLORS[entity.entity_type] + "20",
              color: TYPE_COLORS[entity.entity_type],
            }}
          >
            {entity.entity_type}
          </span>
        </div>
        <button
          onClick={onClose}
          onMouseEnter={() => setCloseHovered(true)}
          onMouseLeave={() => setCloseHovered(false)}
          style={{
            padding: 4,
            borderRadius: "var(--radius-sm)",
            color: closeHovered ? "var(--text-primary)" : "var(--text-muted)",
            background: closeHovered ? "var(--muted)" : "transparent",
            border: "none",
            cursor: "pointer",
            transition: "all 150ms",
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Description */}
        {entity.description && (
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              Description
            </div>
            <p
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--text-secondary)",
                margin: 0,
              }}
            >
              {entity.description}
            </p>
          </div>
        )}

        {/* Outgoing Relations */}
        {relations_out.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              Relations Out
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {relations_out.map((r, i) => (
                <button
                  key={i}
                  onClick={() => onNavigateToEntity(r.target)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "4px 8px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 150ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--accent-soft)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-tertiary)";
                  }}
                >
                  <ArrowRight size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
                  <span style={{ color: "var(--accent)", fontWeight: 500 }}>{r.target}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({r.predicate})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Incoming Relations */}
        {relations_in.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              Relations In
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {relations_in.map((r, i) => (
                <button
                  key={i}
                  onClick={() => onNavigateToEntity(r.source)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "4px 8px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 150ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--accent-soft)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-tertiary)";
                  }}
                >
                  <ArrowLeft size={12} style={{ color: "var(--purple)", flexShrink: 0 }} />
                  <span style={{ color: "var(--purple)", fontWeight: 500 }}>{r.source}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({r.predicate})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Source Notes */}
        {entity.source_notes.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              Source Notes
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {entity.source_notes.map((note, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    padding: "2px 0",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {note}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aliases */}
        {entity.aliases.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              Aliases
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {entity.aliases.map((alias) => (
                <span
                  key={alias}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {alias}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Mention Count */}
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          Mentioned in {mention_count} note
          {mention_count !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
