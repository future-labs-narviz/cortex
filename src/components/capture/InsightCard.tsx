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
    <div
      style={{
        background: 'var(--muted)',
        border: '1px solid var(--border)',
        borderLeft: '2px solid var(--yellow)',
        borderRadius: 'var(--radius-xl)',
        padding: 16,
        marginBottom: 8,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              fontFamily: '"JetBrains Mono", "SF Mono", monospace',
            }}
          >
            {formatTime(insight.created_at)}
          </span>
          <span
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 2,
              paddingBottom: 2,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(245, 158, 11, 0.1)',
              color: 'var(--yellow)',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {insight.source}
          </span>
        </div>

        <p
          style={{
            fontSize: 12,
            color: 'var(--text-primary)',
            lineHeight: 1.6,
          }}
        >
          {insight.content}
        </p>

        {insight.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {insight.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 10,
                  paddingLeft: 6,
                  paddingRight: 6,
                  paddingTop: 2,
                  paddingBottom: 2,
                  borderRadius: 9999,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
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
