export const CHANNELS = ["email", "web", "phone", "chat"] as const;
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const STATUSES = ["new", "in_progress", "resolved"] as const;

export type Channel = (typeof CHANNELS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];

export interface IntakeMessage {
  id: number;
  sender: string;
  subject: string;
  body: string;
  channel: Channel;
  priority: Priority;
  status: Status;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntakeInput {
  sender: string;
  subject: string;
  body?: string;
  channel?: Channel;
  priority?: Priority;
  assignee?: string | null;
}

export interface UpdateIntakeInput {
  status?: Status;
  priority?: Priority;
  assignee?: string | null;
}
