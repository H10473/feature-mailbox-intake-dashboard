import type Database from "better-sqlite3";
import {
  CHANNELS,
  PRIORITIES,
  STATUSES,
  type CreateIntakeInput,
  type IntakeMessage,
  type Status,
  type UpdateIntakeInput,
} from "./types.js";

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

export class MessageRepository {
  constructor(private readonly db: Database.Database) {}

  list(status?: string): IntakeMessage[] {
    if (status && status !== "all") {
      if (!STATUSES.includes(status as Status)) {
        throw new ValidationError(`Invalid status filter: ${status}`);
      }
      return this.db
        .prepare(
          "SELECT * FROM messages WHERE status = ? ORDER BY datetime(createdAt) DESC, id DESC"
        )
        .all(status) as IntakeMessage[];
    }
    return this.db
      .prepare(
        "SELECT * FROM messages ORDER BY datetime(createdAt) DESC, id DESC"
      )
      .all() as IntakeMessage[];
  }

  get(id: number): IntakeMessage {
    const row = this.db
      .prepare("SELECT * FROM messages WHERE id = ?")
      .get(id) as IntakeMessage | undefined;
    if (!row) throw new NotFoundError(`Message ${id} not found`);
    return row;
  }

  create(input: CreateIntakeInput): IntakeMessage {
    const sender = (input.sender ?? "").trim();
    const subject = (input.subject ?? "").trim();
    if (!sender) throw new ValidationError("sender is required");
    if (!subject) throw new ValidationError("subject is required");

    const channel = input.channel ?? "email";
    const priority = input.priority ?? "normal";
    if (!CHANNELS.includes(channel)) {
      throw new ValidationError(`Invalid channel: ${channel}`);
    }
    if (!PRIORITIES.includes(priority)) {
      throw new ValidationError(`Invalid priority: ${priority}`);
    }

    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO messages (sender, subject, body, channel, priority, status, assignee, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'new', ?, ?, ?)`
      )
      .run(
        sender,
        subject,
        input.body ?? "",
        channel,
        priority,
        input.assignee ?? null,
        now,
        now
      );
    return this.get(Number(result.lastInsertRowid));
  }

  update(id: number, input: UpdateIntakeInput): IntakeMessage {
    const existing = this.get(id);

    const status = input.status ?? existing.status;
    const priority = input.priority ?? existing.priority;
    if (input.status && !STATUSES.includes(input.status)) {
      throw new ValidationError(`Invalid status: ${input.status}`);
    }
    if (input.priority && !PRIORITIES.includes(input.priority)) {
      throw new ValidationError(`Invalid priority: ${input.priority}`);
    }
    const assignee =
      input.assignee === undefined ? existing.assignee : input.assignee;

    const now = new Date().toISOString();
    this.db
      .prepare(
        "UPDATE messages SET status = ?, priority = ?, assignee = ?, updatedAt = ? WHERE id = ?"
      )
      .run(status, priority, assignee, now, id);
    return this.get(id);
  }

  remove(id: number): void {
    const result = this.db.prepare("DELETE FROM messages WHERE id = ?").run(id);
    if (result.changes === 0) throw new NotFoundError(`Message ${id} not found`);
  }

  stats(): { total: number; byStatus: Record<Status, number> } {
    const rows = this.db
      .prepare("SELECT status, COUNT(*) AS count FROM messages GROUP BY status")
      .all() as { status: Status; count: number }[];
    const byStatus: Record<Status, number> = {
      new: 0,
      in_progress: 0,
      resolved: 0,
    };
    let total = 0;
    for (const r of rows) {
      byStatus[r.status] = r.count;
      total += r.count;
    }
    return { total, byStatus };
  }
}
