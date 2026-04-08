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
    <div className="bg-[var(--muted)] border border-[var(--border)] border-l-2 border-l-[var(--yellow)] rounded-[var(--radius-xl)] p-4 mb-2">
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {formatTime(insight.created_at)}
          </span>
          <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--yellow)]/10 text-[var(--yellow)] text-xs font-medium">
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
