import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

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
      sender TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL DEFAULT 'email',
      priority TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'new',
      assignee TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
  return db;
}

const SEED_ROWS = [
  {
    sender: "ada@lovelace.example",
    subject: "Cannot access my invoice",
    body: "The download link on my invoice page returns a 404.",
    channel: "email",
    priority: "high",
    status: "new",
    assignee: null,
  },
  {
    sender: "grace@hopper.example",
    subject: "Feature request: dark mode",
    body: "Would love a dark theme for the dashboard.",
    channel: "web",
    priority: "low",
    status: "in_progress",
    assignee: "triage-bot",
  },
  {
    sender: "alan@turing.example",
    subject: "Refund not received",
    body: "I was told my refund would arrive in 5 days. It has been 12.",
    channel: "phone",
    priority: "urgent",
    status: "new",
    assignee: null,
  },
];

export function seedIfEmpty(db: Database.Database): void {
  const row = db.prepare("SELECT COUNT(*) AS count FROM messages").get() as {
    count: number;
  };
  if (row.count > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO messages (sender, subject, body, channel, priority, status, assignee, createdAt, updatedAt)
     VALUES (@sender, @subject, @body, @channel, @priority, @status, @assignee, @createdAt, @updatedAt)`
  );
  const insertMany = db.transaction((rows: typeof SEED_ROWS) => {
    for (const r of rows) {
      insert.run({ ...r, createdAt: now, updatedAt: now });
    }
  });
  insertMany(SEED_ROWS);
}
