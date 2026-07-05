import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type Database from "better-sqlite3";
import { createApp } from "./app.js";
import { createDb } from "./db.js";

describe("Mailbox Intake API", () => {
  let db: Database.Database;
  let app: Express;

  beforeEach(() => {
    db = createDb(":memory:");
    app = createApp(db);
  });

  afterEach(() => {
    db.close();
  });

  it("starts with an empty mailbox", async () => {
    const res = await request(app).get("/api/messages");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("creates an intake message", async () => {
    const res = await request(app)
      .post("/api/messages")
      .send({ sender: "user@example.com", subject: "Help", body: "Please help", priority: "high" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      sender: "user@example.com",
      subject: "Help",
      status: "new",
      priority: "high",
    });
    expect(res.body.id).toBeGreaterThan(0);
  });

  it("rejects an intake without a subject", async () => {
    const res = await request(app)
      .post("/api/messages")
      .send({ sender: "user@example.com" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/subject/i);
  });

  it("updates the status of a message", async () => {
    const created = await request(app)
      .post("/api/messages")
      .send({ sender: "user@example.com", subject: "Ticket" });
    const id = created.body.id;

    const updated = await request(app)
      .patch(`/api/messages/${id}`)
      .send({ status: "resolved", assignee: "agent-1" });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe("resolved");
    expect(updated.body.assignee).toBe("agent-1");
  });

  it("returns 404 for a missing message", async () => {
    const res = await request(app).get("/api/messages/9999");
    expect(res.status).toBe(404);
  });

  it("reports stats grouped by status", async () => {
    await request(app).post("/api/messages").send({ sender: "a@x.com", subject: "one" });
    await request(app).post("/api/messages").send({ sender: "b@x.com", subject: "two" });
    const created = await request(app).post("/api/messages").send({ sender: "c@x.com", subject: "three" });
    await request(app).patch(`/api/messages/${created.body.id}`).send({ status: "resolved" });

    const res = await request(app).get("/api/stats");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.byStatus.new).toBe(2);
    expect(res.body.byStatus.resolved).toBe(1);
  });
});
