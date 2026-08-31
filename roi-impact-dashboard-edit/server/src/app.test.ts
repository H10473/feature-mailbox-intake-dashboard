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

  it("exposes mailbox + SLA config", async () => {
    const res = await request(app).get("/api/config");
    expect(res.status).toBe(200);
    expect(res.body.mailbox).toContain("@");
    expect(res.body.ackSlaMinutes).toBe(15);
    expect(res.body.completionSlaMinutes).toBe(240);
  });

  it("creates an intake message with received time and pending SLA", async () => {
    const res = await request(app)
      .post("/api/messages")
      .send({ sender: "user@example.com", subject: "Help", priority: "high" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      subject: "Help",
      status: "new",
      priority: "high",
      ackSla: "pending",
      completionSla: "pending",
    });
    expect(res.body.receivedAt).toBeTruthy();
    expect(res.body.firstResponseMinutes).toBeNull();
  });

  it("rejects an intake without a subject", async () => {
    const res = await request(app)
      .post("/api/messages")
      .send({ sender: "user@example.com" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/subject/i);
  });

  it("acknowledging within SLA marks ack as met and computes response minutes", async () => {
    const created = await request(app)
      .post("/api/messages")
      .send({ sender: "user@example.com", subject: "Ticket" });
    const id = created.body.id;

    const ack = await request(app).post(`/api/messages/${id}/acknowledge`);
    expect(ack.status).toBe(200);
    expect(ack.body.status).toBe("in_progress");
    expect(ack.body.firstResponseAt).toBeTruthy();
    expect(ack.body.ackSla).toBe("met");
    expect(ack.body.firstResponseMinutes).toBeGreaterThanOrEqual(0);
  });

  it("computes breached ack SLA for an old unacknowledged email", async () => {
    const oldReceived = new Date(Date.now() - 60 * 60_000).toISOString(); // 1h ago
    const created = await request(app)
      .post("/api/messages")
      .send({ sender: "late@example.com", subject: "Old", receivedAt: oldReceived });
    expect(created.body.ackSla).toBe("breached");
    expect(created.body.completionSla).toBe("pending");
    expect(created.body.ageMinutes).toBeGreaterThan(15);
  });

  it("completing an email records resolution and resolves it", async () => {
    const created = await request(app)
      .post("/api/messages")
      .send({ sender: "user@example.com", subject: "Done soon" });
    const id = created.body.id;

    const done = await request(app).post(`/api/messages/${id}/complete`);
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("resolved");
    expect(done.body.resolvedAt).toBeTruthy();
    expect(done.body.completionSla).toBe("met");
  });

  it("returns 404 for a missing message", async () => {
    const res = await request(app).get("/api/messages/9999");
    expect(res.status).toBe(404);
  });

  it("reports KPIs including SLA compliance", async () => {
    // Two acknowledged-in-time + one breached (old, unacknowledged).
    await request(app).post("/api/messages").send({ sender: "a@x.com", subject: "one" });
    const two = await request(app).post("/api/messages").send({ sender: "b@x.com", subject: "two" });
    await request(app).post(`/api/messages/${two.body.id}/acknowledge`);
    await request(app)
      .post("/api/messages")
      .send({
        sender: "c@x.com",
        subject: "old",
        receivedAt: new Date(Date.now() - 90 * 60_000).toISOString(),
      });

    const res = await request(app).get("/api/kpis");
    expect(res.status).toBe(200);
    expect(res.body.volume).toBe(3);
    expect(res.body.open).toBe(3);
    expect(res.body.ackBreaches).toBe(1);
    expect(res.body.ackSlaCompliancePct).toBeLessThan(100);
  });

  it("buckets open emails by age", async () => {
    await request(app).post("/api/messages").send({ sender: "fresh@x.com", subject: "fresh" });
    await request(app)
      .post("/api/messages")
      .send({
        sender: "old@x.com",
        subject: "old",
        receivedAt: new Date(Date.now() - 5 * 60 * 60_000).toISOString(),
      });

    const res = await request(app).get("/api/aging");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body[0].count).toBe(1); // fresh in ack window
    expect(res.body[3].count).toBe(1); // >4h breached
  });

  it("assigns folders and routes them through the workflow", async () => {
    const normal = await request(app)
      .post("/api/messages")
      .send({ sender: "a@x.com", subject: "normal" });
    expect(normal.body.folder).toBe("Inbox");

    const urgent = await request(app)
      .post("/api/messages")
      .send({ sender: "b@x.com", subject: "urgent", priority: "urgent" });
    expect(urgent.body.folder).toBe("Escalations");

    const ack = await request(app).post(`/api/messages/${normal.body.id}/acknowledge`);
    expect(ack.body.folder).toBe("Processing");

    const done = await request(app).post(`/api/messages/${urgent.body.id}/complete`);
    expect(done.body.folder).toBe("Completed");
  });

  it("returns a 7x24 day/hour heatmap", async () => {
    await request(app)
      .post("/api/messages")
      .send({
        sender: "a@x.com",
        subject: "heat",
        receivedAt: "2026-07-06T09:30:00.000Z", // Monday 09:00 UTC
      });

    const res = await request(app).get("/api/heatmap");
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(7);
    expect(res.body.hours).toHaveLength(24);
    expect(res.body.total).toBe(1);
    expect(res.body.max).toBe(1);
    // Monday = day index 1, hour 9.
    expect(res.body.rows[1].counts[9]).toBe(1);
  });

  it("returns a trend series of the requested length", async () => {
    await request(app).post("/api/messages").send({ sender: "a@x.com", subject: "today" });
    const res = await request(app).get("/api/trends?days=7");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
    const today = res.body[res.body.length - 1];
    expect(today.received).toBe(1);
  });
});
