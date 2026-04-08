import type { CapturedInsight } from "@/lib/types";

interface InsightCardProps {
  insight: CapturedInsight;
}

function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function InsightCard({ insight }: InsightCardProps) {
  return (
    <div className="flex gap-3 py-2">
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-1">
        <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
        <div className="w-px flex-1 bg-[var(--border)] mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            {formatTime(insight.created_at)}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">
            {insight.source}
          </span>
        </div>

        <p className="text-xs text-[var(--text-primary)] leading-relaxed">
          {insight.content}
        </p>

        {insight.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {insight.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
