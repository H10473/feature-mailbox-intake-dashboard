export const CHANNELS = ["email", "web", "phone", "chat"] as const;
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const STATUSES = ["new", "in_progress", "resolved"] as const;

export type Channel = (typeof CHANNELS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];
export type SlaState = "met" | "breached" | "pending";

export interface IntakeMessage {
  id: number;
  messageId: string | null;
  mailbox: string;
  folder: string;
  webLink: string | null;
  sender: string;
  subject: string;
  body: string;
  channel: Channel;
  priority: Priority;
  status: Status;
  assignee: string | null;
  receivedAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  firstResponseMinutes: number | null;
  resolutionMinutes: number | null;
  ageMinutes: number;
  ackSla: SlaState;
  completionSla: SlaState;
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

export interface AgingBucket {
  key: string;
  label: string;
  count: number;
}

export interface TrendPoint {
  date: string;
  received: number;
  resolved: number;
  avgFirstResponseMinutes: number | null;
  ackSlaCompliancePct: number;
}

export interface HeatmapRow {
  day: number;
  label: string;
  counts: number[];
}

export interface Heatmap {
  hours: number[];
  rows: HeatmapRow[];
  max: number;
  total: number;
}

export interface AppConfig {
  mailbox: string;
  ackSlaMinutes: number;
  completionSlaMinutes: number;
}
