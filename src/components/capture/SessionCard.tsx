import { useState } from "react";
import { ChevronDown, ChevronRight, Clock, FileText, Terminal, Lightbulb } from "lucide-react";
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

export function SessionCard({ session }: SessionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isActive = !session.ended_at;
  const duration = computeDuration(session.started_at, session.ended_at);
  const title = session.summary || session.goal || "Development session";

  return (
    <div className="flex gap-3 py-2">
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-1">
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            isActive
              ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]"
              : "bg-[var(--accent)]"
          }`}
        />
        <div className="w-px flex-1 bg-[var(--border)] mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-3">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-start gap-1.5 w-full text-left group cursor-pointer"
        >
          {expanded ? (
            <ChevronDown size={12} className="mt-0.5 text-[var(--text-muted)] flex-shrink-0" />
          ) : (
            <ChevronRight size={12} className="mt-0.5 text-[var(--text-muted)] flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {formatTime(session.started_at)}
                {session.ended_at ? ` - ${formatTime(session.ended_at)}` : ""}
              </span>
              {isActive && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-medium">
                  active
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-[var(--text-primary)] leading-snug group-hover:text-[var(--accent)] transition-colors truncate">
              {title}
            </p>
          </div>
        </button>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-1.5 ml-4">
          <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Clock size={10} />
            {duration}
          </span>
          {session.prompts_count > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <Terminal size={10} />
              {session.prompts_count} prompts
            </span>
          )}
          {session.files_modified.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <FileText size={10} />
              {session.files_modified.length} files
            </span>
          )}
        </div>

        {/* Key decision preview (when not expanded) */}
        {!expanded && session.key_decisions.length > 0 && (
          <div className="mt-1.5 ml-4">
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <Lightbulb size={10} className="text-amber-400" />
              {session.key_decisions[0]}
            </span>
          </div>
        )}

        {/* Expanded details */}
        {expanded && (
          <div className="mt-2 ml-4 space-y-2">
            {session.key_decisions.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Key Decisions
                </h4>
                <ul className="space-y-0.5">
                  {session.key_decisions.map((decision, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-[var(--text-secondary)]">
                      <Lightbulb size={10} className="mt-0.5 text-amber-400 flex-shrink-0" />
                      {decision}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {session.what_worked && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-green-400/70 mb-1">
                  What Worked
                </h4>
                <p className="text-[11px] text-[var(--text-secondary)]">{session.what_worked}</p>
              </div>
            )}

            {session.what_failed && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-red-400/70 mb-1">
                  What Failed
                </h4>
                <p className="text-[11px] text-[var(--text-secondary)]">{session.what_failed}</p>
              </div>
            )}

            {session.files_modified.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Files Modified
                </h4>
                <ul className="space-y-0.5">
                  {session.files_modified.map((file) => (
                    <li key={file} className="text-[11px] text-[var(--text-muted)] font-mono">
                      {file}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {session.tools_used.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Tools Used
                </h4>
                <div className="flex flex-wrap gap-1">
                  {session.tools_used.map((tool) => (
                    <span
                      key={tool}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
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
  );
}
