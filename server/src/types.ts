export const CHANNELS = ["email", "web", "phone", "chat"] as const;
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const STATUSES = ["new", "in_progress", "resolved"] as const;

export type Channel = (typeof CHANNELS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];

/** SLA outcome for a single email against a threshold. */
export type SlaState = "met" | "breached" | "pending";

export interface IntakeMessage {
  id: number;
  messageId: string | null;
  mailbox: string;
  sender: string;
  subject: string;
  body: string;
  channel: Channel;
  priority: Priority;
  status: Status;
  assignee: string | null;
  /** When the email arrived in the mailbox. */
  receivedAt: string;
  /** When the first response / acknowledgement was sent. */
  firstResponseAt: string | null;
  /** When the email was fully resolved / completed. */
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Message plus derived KPI/SLA fields computed relative to "now". */
export interface EnrichedMessage extends IntakeMessage {
  firstResponseMinutes: number | null;
  resolutionMinutes: number | null;
  ageMinutes: number;
  ackSla: SlaState;
  completionSla: SlaState;
}

export interface CreateIntakeInput {
  sender: string;
  subject: string;
  body?: string;
  channel?: Channel;
  priority?: Priority;
  assignee?: string | null;
  receivedAt?: string;
}

export interface UpdateIntakeInput {
  status?: Status;
  priority?: Priority;
  assignee?: string | null;
}
