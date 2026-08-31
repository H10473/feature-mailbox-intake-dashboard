import type { Kpis } from "../types";
import { formatMinutes } from "../format";

function complianceTone(pct: number): string {
  if (pct >= 95) return "good";
  if (pct >= 85) return "warn";
  return "bad";
}

export function KpiCards({ kpis }: { kpis: Kpis | null }) {
  const cards = [
    {
      key: "volume",
      label: "Volume (14d)",
      value: kpis?.volume ?? 0,
      sub: `${kpis?.open ?? 0} open · ${kpis?.resolved ?? 0} resolved`,
      tone: "neutral",
    },
    {
      key: "fr",
      label: "Avg First Response",
      value: formatMinutes(kpis?.avgFirstResponseMinutes ?? null),
      sub: `target ≤ ${kpis?.ackSlaMinutes ?? 15}m`,
      tone: "neutral",
    },
    {
      key: "ack",
      label: "Ack SLA (≤15m)",
      value: `${kpis?.ackSlaCompliancePct ?? 0}%`,
      sub: `${kpis?.ackBreaches ?? 0} breaches`,
      tone: kpis ? complianceTone(kpis.ackSlaCompliancePct) : "neutral",
    },
    {
      key: "comp",
      label: "Completion SLA (≤4h)",
      value: `${kpis?.completionSlaCompliancePct ?? 0}%`,
      sub: `${kpis?.completionBreaches ?? 0} breaches`,
      tone: kpis ? complianceTone(kpis.completionSlaCompliancePct) : "neutral",
    },
    {
      key: "handle",
      label: "Avg Handle Time",
      value: formatMinutes(kpis?.avgResolutionMinutes ?? null),
      sub: `target ≤ ${formatMinutes(kpis?.completionSlaMinutes ?? 240)}`,
      tone: "neutral",
    },
  ];

  return (
    <section className="kpis">
      {cards.map((c) => (
        <div key={c.key} className={`kpi-card kpi-card--${c.tone}`}>
          <span className="kpi-label">{c.label}</span>
          <span className="kpi-value">{c.value}</span>
          <span className="kpi-sub">{c.sub}</span>
        </div>
      ))}
    </section>
  );
}
