import type Database from "better-sqlite3";
import { MAILBOX_ADDRESS } from "./config.js";
import {
  computeAging,
  computeHeatmap,
  computeKpis,
  computeTrends,
  enrich,
  type AgingBucket,
  type Heatmap,
  type Kpis,
  type TrendPoint,
} from "./metrics.js";
import {
  CHANNELS,
  PRIORITIES,
  STATUSES,
  type CreateIntakeInput,
  type EnrichedMessage,
  type IntakeMessage,
  type Status,
  type UpdateIntakeInput,
} from "./types.js";

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

export class MessageRepository {
  constructor(private readonly db: Database.Database) {}

  private allRaw(): IntakeMessage[] {
    return this.db
      .prepare("SELECT * FROM messages ORDER BY datetime(receivedAt) DESC, id DESC")
      .all() as IntakeMessage[];
  }

  list(status: string | undefined, now: Date = new Date()): EnrichedMessage[] {
    let rows: IntakeMessage[];
    if (status && status !== "all") {
      if (!STATUSES.includes(status as Status)) {
        throw new ValidationError(`Invalid status filter: ${status}`);
      }
      rows = this.db
        .prepare(
          "SELECT * FROM messages WHERE status = ? ORDER BY datetime(receivedAt) DESC, id DESC"
        )
        .all(status) as IntakeMessage[];
    } else {
      rows = this.allRaw();
    }
    return rows.map((r) => enrich(r, now));
  }

  getRaw(id: number): IntakeMessage {
    const row = this.db
      .prepare("SELECT * FROM messages WHERE id = ?")
      .get(id) as IntakeMessage | undefined;
    if (!row) throw new NotFoundError(`Message ${id} not found`);
    return row;
  }

  get(id: number, now: Date = new Date()): EnrichedMessage {
    return enrich(this.getRaw(id), now);
  }

  create(input: CreateIntakeInput, now: Date = new Date()): EnrichedMessage {
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

    const nowIso = now.toISOString();
    const receivedAt = input.receivedAt ?? nowIso;
    const folder = priority === "urgent" ? "Escalations" : "Inbox";
    const result = this.db
      .prepare(
        `INSERT INTO messages
           (messageId, mailbox, folder, webLink, sender, subject, body, channel, priority, status, assignee, receivedAt, firstResponseAt, resolvedAt, createdAt, updatedAt)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 'new', ?, ?, NULL, NULL, ?, ?)`
      )
      .run(
        null,
        MAILBOX_ADDRESS,
        folder,
        sender,
        subject,
        input.body ?? "",
        channel,
        priority,
        input.assignee ?? null,
        receivedAt,
        nowIso,
        nowIso
      );
    return this.get(Number(result.lastInsertRowid), now);
  }

  update(id: number, input: UpdateIntakeInput, now: Date = new Date()): EnrichedMessage {
    const existing = this.getRaw(id);

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

    this.db
      .prepare(
        "UPDATE messages SET status = ?, priority = ?, assignee = ?, updatedAt = ? WHERE id = ?"
      )
      .run(status, priority, assignee, now.toISOString(), id);
    return this.get(id, now);
  }

  /** Record the first response / acknowledgement (starts the SLA clock stop). */
  acknowledge(id: number, now: Date = new Date()): EnrichedMessage {
    const existing = this.getRaw(id);
    const nowIso = now.toISOString();
    const firstResponseAt = existing.firstResponseAt ?? nowIso;
    const status = existing.status === "new" ? "in_progress" : existing.status;
    const folder = existing.status === "resolved" ? existing.folder : "Processing";
    this.db
      .prepare(
        "UPDATE messages SET firstResponseAt = ?, status = ?, folder = ?, updatedAt = ? WHERE id = ?"
      )
      .run(firstResponseAt, status, folder, nowIso, id);
    return this.get(id, now);
  }

  /** Mark the email fully resolved / completed. */
  complete(id: number, now: Date = new Date()): EnrichedMessage {
    const existing = this.getRaw(id);
    const nowIso = now.toISOString();
    const firstResponseAt = existing.firstResponseAt ?? nowIso;
    this.db
      .prepare(
        "UPDATE messages SET status = 'resolved', folder = 'Completed', firstResponseAt = ?, resolvedAt = ?, updatedAt = ? WHERE id = ?"
      )
      .run(firstResponseAt, nowIso, nowIso, id);
    return this.get(id, now);
  }

  remove(id: number): void {
    const result = this.db.prepare("DELETE FROM messages WHERE id = ?").run(id);
    if (result.changes === 0) throw new NotFoundError(`Message ${id} not found`);
  }

  kpis(now: Date = new Date()): Kpis {
    return computeKpis(this.allRaw(), now, MAILBOX_ADDRESS);
  }

  aging(now: Date = new Date()): AgingBucket[] {
    return computeAging(this.allRaw(), now);
  }

  trends(days = 14, now: Date = new Date()): TrendPoint[] {
    return computeTrends(this.allRaw(), now, days);
  }

  heatmap(): Heatmap {
    return computeHeatmap(this.allRaw());
  }
}
