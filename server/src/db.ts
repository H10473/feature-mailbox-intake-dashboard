import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ACK_SLA_MINUTES, COMPLETION_SLA_MINUTES, MAILBOX_ADDRESS } from "./config.js";
import { PRIORITIES, type Channel, type Priority } from "./types.js";

export function createDb(dbPath: string): Database.Database {
  if (dbPath !== ":memory:") {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      messageId TEXT,
      mailbox TEXT NOT NULL,
      folder TEXT NOT NULL DEFAULT 'Inbox',
      webLink TEXT,
      sender TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL DEFAULT 'email',
      priority TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'new',
      assignee TEXT,
      receivedAt TEXT NOT NULL,
      firstResponseAt TEXT,
      resolvedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_receivedAt ON messages(receivedAt);
    CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
  `);
  return db;
}

// --- Deterministic seed generator -----------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SENDERS = [
  "escrow.team@titlepartner.example",
  "wires@lenderops.example",
  "closing@realtygroup.example",
  "payoffs@servicerbank.example",
  "docs@settlementco.example",
  "ops@brokerdesk.example",
  "recording@countyclerk.example",
  "funding@mortgagehub.example",
];

const SUBJECTS = [
  "Wire confirmation request - File #",
  "Payoff statement needed - Loan #",
  "Title commitment upload - Order #",
  "Closing disbursement approval - File #",
  "Recording confirmation - Instrument #",
  "CD reconciliation question - File #",
  "Missing endorsement request - Order #",
  "Funding authorization - Loan #",
  "Escrow shortage inquiry - File #",
  "Document correction request - Order #",
];

const ASSIGNEES = ["priya.n", "arjun.k", "meera.s", "rahul.d", "ananya.r"];

interface SeedRow {
  messageId: string;
  mailbox: string;
  folder: string;
  webLink: string | null;
  sender: string;
  subject: string;
  body: string;
  channel: Channel;
  priority: Priority;
  status: string;
  assignee: string | null;
  receivedAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function generateSeed(now: Date, count = 90): SeedRow[] {
  const rand = mulberry32(20260706);
  const rows: SeedRow[] = [];

  for (let i = 0; i < count; i++) {
    // Spread arrivals across the last 14 days, biased to business hours.
    const daysAgo = Math.floor(rand() * 14);
    const hour = 8 + Math.floor(rand() * 11); // 08:00 - 18:00
    const minute = Math.floor(rand() * 60);
    const received = new Date(now);
    received.setDate(received.getDate() - daysAgo);
    received.setHours(hour, minute, Math.floor(rand() * 60), 0);
    if (received.getTime() > now.getTime()) {
      received.setTime(now.getTime() - Math.floor(rand() * 10 * 60_000));
    }

    const priority = pick(rand, PRIORITIES);
    const sender = pick(rand, SENDERS);
    const subject = `${pick(rand, SUBJECTS)}${100000 + Math.floor(rand() * 900000)}`;

    // Decide lifecycle outcome.
    const roll = rand();
    let status: string;
    let firstResponseAt: string | null = null;
    let resolvedAt: string | null = null;
    let assignee: string | null = null;

    if (roll < 0.7) {
      // Resolved: acknowledged then completed.
      status = "resolved";
      assignee = pick(rand, ASSIGNEES);
      // ~80% acknowledged within SLA, some breach.
      const ackMin = rand() < 0.8 ? rand() * ACK_SLA_MINUTES : ACK_SLA_MINUTES + rand() * 40;
      const fr = new Date(received.getTime() + ackMin * 60_000);
      firstResponseAt = fr.toISOString();
      // ~75% completed within SLA.
      const handleMin =
        rand() < 0.75
          ? ackMin + rand() * (COMPLETION_SLA_MINUTES - ackMin)
          : COMPLETION_SLA_MINUTES + rand() * 180;
      resolvedAt = new Date(received.getTime() + handleMin * 60_000).toISOString();
    } else if (roll < 0.85) {
      // In progress: acknowledged, not yet resolved.
      status = "in_progress";
      assignee = pick(rand, ASSIGNEES);
      const ackMin = rand() < 0.8 ? rand() * ACK_SLA_MINUTES : ACK_SLA_MINUTES + rand() * 30;
      firstResponseAt = new Date(received.getTime() + ackMin * 60_000).toISOString();
    } else {
      // New / open, not acknowledged. Spread arrival across the last several
      // hours so the aging buckets are populated realistically (some fresh,
      // some approaching SLA, some already breached).
      status = "new";
      const r = rand();
      let openAgeMin: number;
      if (r < 0.35) {
        openAgeMin = rand() * ACK_SLA_MINUTES; // within ack window
      } else if (r < 0.6) {
        openAgeMin = ACK_SLA_MINUTES + rand() * (60 - ACK_SLA_MINUTES); // 15m-1h
      } else if (r < 0.8) {
        openAgeMin = 60 + rand() * (COMPLETION_SLA_MINUTES - 60); // 1h-4h
      } else {
        openAgeMin = COMPLETION_SLA_MINUTES + rand() * 24 * 60; // > 4h (breached)
      }
      received.setTime(now.getTime() - Math.floor(openAgeMin * 60_000));
    }

    let folder: string;
    if (status === "resolved") folder = "Completed";
    else if (status === "in_progress") folder = "Processing";
    else folder = priority === "urgent" ? "Escalations" : "Inbox";

    const messageId = `AAMkAG${(100000 + i).toString(16)}Z@firstam`;
    const webLink = `https://outlook.office365.com/owa/?ItemID=${encodeURIComponent(
      messageId
    )}&exvsurl=1&viewmodel=ReadMessageItem`;

    const createdAt = received.toISOString();
    rows.push({
      messageId,
      mailbox: MAILBOX_ADDRESS,
      folder,
      webLink,
      sender,
      subject,
      body: `Regarding ${subject}. Please review and advise on next steps.`,
      channel: "email" as Channel,
      priority,
      status,
      assignee,
      receivedAt: received.toISOString(),
      firstResponseAt,
      resolvedAt,
      createdAt,
      updatedAt: resolvedAt ?? firstResponseAt ?? createdAt,
    });
  }

  // Sort ascending by received time for stable ids.
  rows.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  return rows;
}

export function seedIfEmpty(db: Database.Database, now: Date = new Date()): void {
  const row = db.prepare("SELECT COUNT(*) AS count FROM messages").get() as {
    count: number;
  };
  if (row.count > 0) return;

  const insert = db.prepare(
    `INSERT INTO messages
       (messageId, mailbox, folder, webLink, sender, subject, body, channel, priority, status, assignee, receivedAt, firstResponseAt, resolvedAt, createdAt, updatedAt)
     VALUES
       (@messageId, @mailbox, @folder, @webLink, @sender, @subject, @body, @channel, @priority, @status, @assignee, @receivedAt, @firstResponseAt, @resolvedAt, @createdAt, @updatedAt)`
  );
  const insertMany = db.transaction((rows: SeedRow[]) => {
    for (const r of rows) insert.run(r);
  });
  insertMany(generateSeed(now));
}
