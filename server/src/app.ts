import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import type Database from "better-sqlite3";
import { MAILBOX_ADDRESS, ACK_SLA_MINUTES, COMPLETION_SLA_MINUTES } from "./config.js";
import { MessageRepository, NotFoundError, ValidationError } from "./repository.js";

export function createApp(db: Database.Database): Express {
  const app = express();
  const repo = new MessageRepository(db);

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.get("/api/config", (_req, res) => {
    res.json({
      mailbox: MAILBOX_ADDRESS,
      ackSlaMinutes: ACK_SLA_MINUTES,
      completionSlaMinutes: COMPLETION_SLA_MINUTES,
    });
  });

  app.get("/api/kpis", (_req, res) => {
    res.json(repo.kpis());
  });

  app.get("/api/aging", (_req, res) => {
    res.json(repo.aging());
  });

  app.get("/api/heatmap", (_req, res) => {
    res.json(repo.heatmap());
  });

  app.get("/api/trends", (req, res) => {
    const days = req.query.days ? Number(req.query.days) : 14;
    if (!Number.isFinite(days) || days < 1 || days > 90) {
      throw new ValidationError("days must be between 1 and 90");
    }
    res.json(repo.trends(days));
  });

  app.get("/api/messages", (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json(repo.list(status));
  });

  app.get("/api/messages/:id", (req, res) => {
    res.json(repo.get(Number(req.params.id)));
  });

  app.post("/api/messages", (req, res) => {
    const created = repo.create(req.body ?? {});
    res.status(201).json(created);
  });

  app.patch("/api/messages/:id", (req, res) => {
    res.json(repo.update(Number(req.params.id), req.body ?? {}));
  });

  app.post("/api/messages/:id/acknowledge", (req, res) => {
    res.json(repo.acknowledge(Number(req.params.id)));
  });

  app.post("/api/messages/:id/complete", (req, res) => {
    res.json(repo.complete(Number(req.params.id)));
  });

  app.delete("/api/messages/:id", (req, res) => {
    repo.remove(Number(req.params.id));
    res.status(204).end();
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
