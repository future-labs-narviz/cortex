import { useState } from "react";
import { ChevronRight, Clock, FileText, Terminal, Lightbulb } from "lucide-react";
import type { CapturedSession } from "@/lib/types";

interface SessionCardProps {
  session: CapturedSession;
}

function formatTime(iso: string | null): string {
  if (!iso) return "--:--";
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

function computeDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "ongoing";
  try {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const minutes = Math.round((e - s) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  } catch {
    return "unknown";
  }
}

const mono: React.CSSProperties = {
  fontFamily: '"JetBrains Mono", "SF Mono", monospace',
};

export function SessionCard({ session }: SessionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isActive = !session.ended_at;
  const duration = computeDuration(session.started_at, session.ended_at);
  const title = session.summary || session.goal || "Development session";

  return (
    <div
      style={{
        background: 'var(--muted)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: 16,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Timeline dot */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              flexShrink: 0,
              background: isActive ? 'var(--green)' : 'var(--accent)',
              boxShadow: isActive ? '0 0 0 3px rgba(16,185,129,0.3)' : undefined,
            }}
          />
          <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
          {/* Header */}
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
              padding: 0,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 200ms',
              }}
            >
              <ChevronRight size={12} style={{ marginTop: 2, color: 'var(--text-muted)', flexShrink: 0 }} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', ...mono }}>
                  {formatTime(session.started_at)}
                  {session.ended_at ? ` - ${formatTime(session.ended_at)}` : ""}
                </span>
                {isActive && (
                  <span
                    style={{
                      fontSize: 10,
                      paddingLeft: 6,
                      paddingRight: 6,
                      paddingTop: 2,
                      paddingBottom: 2,
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: 'var(--green)',
                      fontWeight: 500,
                    }}
                  >
                    active
                  </span>
                )}
              </div>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </p>
            </div>
          </button>

          {/* Stats row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, marginLeft: 16 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
              <Clock size={10} />
              {duration}
            </span>
            {session.prompts_count > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                <Terminal size={10} />
                {session.prompts_count} prompts
              </span>
            )}
            {session.files_modified.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                <FileText size={10} />
                {session.files_modified.length} files
              </span>
            )}
          </div>

          {/* Key decision preview (when not expanded) */}
          {!expanded && session.key_decisions.length > 0 && (
            <div style={{ marginTop: 6, marginLeft: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                <Lightbulb size={10} style={{ color: 'var(--yellow)' }} />
                {session.key_decisions[0]}
              </span>
            </div>
          )}

          {/* Expanded details */}
          {expanded && (
            <div style={{ marginTop: 8, marginLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {session.key_decisions.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Key Decisions
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {session.key_decisions.map((decision, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <Lightbulb size={10} style={{ marginTop: 2, color: 'var(--yellow)', flexShrink: 0 }} />
                        {decision}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {session.what_worked && (
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>
                    What Worked
                  </h4>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{session.what_worked}</p>
                </div>
              )}

              {session.what_failed && (
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>
                    What Failed
                  </h4>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{session.what_failed}</p>
                </div>
              )}

              {session.files_modified.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Files Modified
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {session.files_modified.map((file) => (
                      <span key={file} style={{ fontSize: 11, color: 'var(--text-muted)', ...mono }}>
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {session.tools_used.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Tools Used
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {session.tools_used.map((tool) => (
                      <span
                        key={tool}
                        style={{
                          fontSize: 10,
                          paddingLeft: 6,
                          paddingRight: 6,
                          paddingTop: 2,
                          paddingBottom: 2,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-tertiary)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
