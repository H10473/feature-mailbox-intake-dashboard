import type { AgingBucket } from "../types";

const TONES: Record<string, string> = {
  ack_window: "good",
  under_1h: "warn",
  under_4h: "warn",
  over_4h: "bad",
};

export function AgingChart({ buckets }: { buckets: AgingBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="aging">
      {total === 0 ? (
        <p className="empty">No open emails — inbox is clear.</p>
      ) : (
        buckets.map((b) => (
          <div key={b.key} className="aging-row">
            <span className="aging-label">{b.label}</span>
            <div className="aging-track">
              <div
                className={`aging-bar aging-bar--${TONES[b.key] ?? "neutral"}`}
                style={{ width: `${(b.count / max) * 100}%` }}
              />
            </div>
            <span className="aging-count">{b.count}</span>
          </div>
        ))
      )}
    </div>
  );
}
