import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import type Database from "better-sqlite3";
import { MessageRepository, NotFoundError, ValidationError } from "./repository.js";

export function createApp(db: Database.Database): Express {
  const app = express();
  const repo = new MessageRepository(db);

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.get("/api/stats", (_req, res) => {
    res.json(repo.stats());
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
