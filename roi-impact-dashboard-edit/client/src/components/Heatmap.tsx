import type { Heatmap as HeatmapData } from "../types";

function cellColor(count: number, max: number): string {
  if (count === 0) return "var(--panel-2)";
  const intensity = 0.15 + 0.85 * (count / Math.max(1, max));
  return `rgba(99, 102, 241, ${intensity.toFixed(3)})`;
}

function hourLabel(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

export function Heatmap({ data }: { data: HeatmapData | null }) {
  if (!data || data.total === 0) {
    return <p className="empty">No volume data yet.</p>;
  }

  return (
    <div className="heatmap">
      <div className="heatmap-grid">
        <div className="heatmap-corner" />
        {data.hours.map((h) => (
          <div key={h} className="heatmap-hour">
            {h % 3 === 0 ? hourLabel(h) : ""}
          </div>
        ))}
        {data.rows.map((row) => (
          <div key={row.day} className="heatmap-line" style={{ display: "contents" }}>
            <div className="heatmap-day">{row.label}</div>
            {row.counts.map((count, h) => (
              <div
                key={h}
                className="heatmap-cell"
                style={{ background: cellColor(count, data.max) }}
                title={`${row.label} ${hourLabel(h)} — ${count} email${count === 1 ? "" : "s"}`}
              >
                {count > 0 ? count : ""}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        <span className="heatmap-swatch" style={{ background: cellColor(0, data.max) }} />
        <span
          className="heatmap-swatch"
          style={{ background: cellColor(Math.ceil(data.max / 3), data.max) }}
        />
        <span
          className="heatmap-swatch"
          style={{ background: cellColor(Math.ceil((2 * data.max) / 3), data.max) }}
        />
        <span className="heatmap-swatch" style={{ background: cellColor(data.max, data.max) }} />
        <span>More (peak {data.max})</span>
      </div>
    </div>
  );
}
