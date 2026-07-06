import { ACK_SLA_MINUTES, COMPLETION_SLA_MINUTES } from "./config.js";
import type {
  EnrichedMessage,
  IntakeMessage,
  SlaState,
} from "./types.js";

function diffMinutes(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.round((ms / 60_000) * 10) / 10;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function utcDate(iso: string): string {
  return iso.slice(0, 10);
}

/** Attach derived KPI/SLA fields to a message, relative to `now`. */
export function enrich(msg: IntakeMessage, now: Date): EnrichedMessage {
  const nowIso = now.toISOString();
  const firstResponseMinutes = msg.firstResponseAt
    ? diffMinutes(msg.receivedAt, msg.firstResponseAt)
    : null;
  const resolutionMinutes = msg.resolvedAt
    ? diffMinutes(msg.receivedAt, msg.resolvedAt)
    : null;
  const ageMinutes = diffMinutes(msg.receivedAt, nowIso);

  let ackSla: SlaState;
  if (firstResponseMinutes !== null) {
    ackSla = firstResponseMinutes <= ACK_SLA_MINUTES ? "met" : "breached";
  } else {
    ackSla = ageMinutes > ACK_SLA_MINUTES ? "breached" : "pending";
  }

  let completionSla: SlaState;
  if (resolutionMinutes !== null) {
    completionSla =
      resolutionMinutes <= COMPLETION_SLA_MINUTES ? "met" : "breached";
  } else {
    completionSla = ageMinutes > COMPLETION_SLA_MINUTES ? "breached" : "pending";
  }

  return {
    ...msg,
    firstResponseMinutes,
    resolutionMinutes,
    ageMinutes,
    ackSla,
    completionSla,
  };
}

function compliancePct(met: number, breached: number): number {
  const decided = met + breached;
  return decided === 0 ? 100 : round1((met / decided) * 100);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

export interface Kpis {
  mailbox: string;
  ackSlaMinutes: number;
  completionSlaMinutes: number;
  volume: number;
  open: number;
  resolved: number;
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  ackSlaCompliancePct: number;
  completionSlaCompliancePct: number;
  ackBreaches: number;
  completionBreaches: number;
}

export function computeKpis(
  messages: IntakeMessage[],
  now: Date,
  mailbox: string
): Kpis {
  const enriched = messages.map((m) => enrich(m, now));

  let ackMet = 0;
  let ackBreached = 0;
  let compMet = 0;
  let compBreached = 0;
  const frMinutes: number[] = [];
  const resMinutes: number[] = [];
  let open = 0;
  let resolved = 0;

  for (const m of enriched) {
    if (m.status === "resolved") resolved++;
    else open++;

    if (m.ackSla === "met") ackMet++;
    else if (m.ackSla === "breached") ackBreached++;

    if (m.completionSla === "met") compMet++;
    else if (m.completionSla === "breached") compBreached++;

    if (m.firstResponseMinutes !== null) frMinutes.push(m.firstResponseMinutes);
    if (m.resolutionMinutes !== null) resMinutes.push(m.resolutionMinutes);
  }

  return {
    mailbox,
    ackSlaMinutes: ACK_SLA_MINUTES,
    completionSlaMinutes: COMPLETION_SLA_MINUTES,
    volume: enriched.length,
    open,
    resolved,
    avgFirstResponseMinutes: average(frMinutes),
    avgResolutionMinutes: average(resMinutes),
    ackSlaCompliancePct: compliancePct(ackMet, ackBreached),
    completionSlaCompliancePct: compliancePct(compMet, compBreached),
    ackBreaches: ackBreached,
    completionBreaches: compBreached,
  };
}

export interface AgingBucket {
  key: string;
  label: string;
  count: number;
}

export function computeAging(messages: IntakeMessage[], now: Date): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { key: "ack_window", label: `\u2264 ${ACK_SLA_MINUTES}m (ack window)`, count: 0 },
    { key: "under_1h", label: `${ACK_SLA_MINUTES}m \u2013 1h`, count: 0 },
    { key: "under_4h", label: "1h \u2013 4h", count: 0 },
    { key: "over_4h", label: "> 4h (SLA breached)", count: 0 },
  ];

  for (const msg of messages) {
    if (msg.status === "resolved") continue;
    const { ageMinutes } = enrich(msg, now);
    if (ageMinutes <= ACK_SLA_MINUTES) buckets[0].count++;
    else if (ageMinutes <= 60) buckets[1].count++;
    else if (ageMinutes <= COMPLETION_SLA_MINUTES) buckets[2].count++;
    else buckets[3].count++;
  }

  return buckets;
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface HeatmapRow {
  day: number;
  label: string;
  counts: number[]; // length 24, index = hour
}

export interface Heatmap {
  hours: number[];
  rows: HeatmapRow[];
  max: number;
  total: number;
}

/** Volume of received emails by day-of-week (rows) and hour-of-day (columns). */
export function computeHeatmap(messages: IntakeMessage[]): Heatmap {
  const rows: HeatmapRow[] = DAY_LABELS.map((label, day) => ({
    day,
    label,
    counts: new Array(24).fill(0),
  }));

  let max = 0;
  let total = 0;
  for (const msg of messages) {
    const d = new Date(msg.receivedAt);
    const day = d.getUTCDay();
    const hour = d.getUTCHours();
    const next = ++rows[day].counts[hour];
    if (next > max) max = next;
    total++;
  }

  return { hours: Array.from({ length: 24 }, (_, h) => h), rows, max, total };
}

export interface TrendPoint {
  date: string;
  received: number;
  resolved: number;
  avgFirstResponseMinutes: number | null;
  ackSlaCompliancePct: number;
}

export function computeTrends(
  messages: IntakeMessage[],
  now: Date,
  days = 14
): TrendPoint[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const byDate = new Map<
    string,
    { received: number; resolved: number; fr: number[]; ackMet: number; ackBreached: number }
  >();
  for (const date of dates) {
    byDate.set(date, { received: 0, resolved: 0, fr: [], ackMet: 0, ackBreached: 0 });
  }

  for (const msg of messages) {
    const recDate = utcDate(msg.receivedAt);
    const bucket = byDate.get(recDate);
    if (bucket) {
      bucket.received++;
      const e = enrich(msg, now);
      if (e.firstResponseMinutes !== null) {
        bucket.fr.push(e.firstResponseMinutes);
        if (e.ackSla === "met") bucket.ackMet++;
        else if (e.ackSla === "breached") bucket.ackBreached++;
      } else if (e.ackSla === "breached") {
        bucket.ackBreached++;
      }
    }
    if (msg.resolvedAt) {
      const resDate = utcDate(msg.resolvedAt);
      const resBucket = byDate.get(resDate);
      if (resBucket) resBucket.resolved++;
    }
  }

  return dates.map((date) => {
    const b = byDate.get(date)!;
    return {
      date,
      received: b.received,
      resolved: b.resolved,
      avgFirstResponseMinutes: average(b.fr),
      ackSlaCompliancePct: compliancePct(b.ackMet, b.ackBreached),
    };
  });
}
