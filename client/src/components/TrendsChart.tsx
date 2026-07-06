import type { TrendPoint } from "../types";
import { formatDay } from "../format";

export function TrendsChart({ points }: { points: TrendPoint[] }) {
  const maxVolume = Math.max(1, ...points.map((p) => Math.max(p.received, p.resolved)));

  return (
    <div className="trends">
      <div className="trends-legend">
        <span className="legend legend--received">Received</span>
        <span className="legend legend--resolved">Resolved</span>
      </div>
      <div className="trends-chart">
        {points.map((p) => (
          <div key={p.date} className="trend-col" title={
            `${p.date}\nReceived: ${p.received}\nResolved: ${p.resolved}\n` +
            `Ack SLA: ${p.ackSlaCompliancePct}%` +
            (p.avgFirstResponseMinutes !== null
              ? `\nAvg first response: ${p.avgFirstResponseMinutes}m`
              : "")
          }>
            <div className="trend-bars">
              <div
                className="trend-bar trend-bar--received"
                style={{ height: `${(p.received / maxVolume) * 100}%` }}
              />
              <div
                className="trend-bar trend-bar--resolved"
                style={{ height: `${(p.resolved / maxVolume) * 100}%` }}
              />
            </div>
            <span className="trend-x">{formatDay(p.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
