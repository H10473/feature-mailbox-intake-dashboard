# feature-mailbox-intake-dashboard

A **Mailbox Intake Dashboard** for triaging and managing incoming messages
(support tickets, requests, etc.). Messages arrive on multiple channels, are
prioritized, and move through a simple workflow: `new → in_progress → resolved`.

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite (`client/`)
- **Backend:** Express + TypeScript + SQLite (`better-sqlite3`) (`server/`)
- **Monorepo:** npm workspaces

## Getting started

```bash
npm install      # install all workspace dependencies
npm run dev      # start API (:4000) + Vite dev server (:5173)
```

Then open http://localhost:5173.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run backend + frontend in watch mode |
| `npm run dev:server` | Run only the API (port 4000) |
| `npm run dev:client` | Run only the frontend (port 5173) |
| `npm run build` | Type-check and build both packages |
| `npm run lint` | Lint both packages |
| `npm test` | Run backend API tests (Vitest + Supertest) |

## API

Base URL: `http://localhost:4000`

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/stats` | Counts by status |
| `GET` | `/api/messages?status=` | List messages (optional status filter) |
| `POST` | `/api/messages` | Create an intake message |
| `PATCH` | `/api/messages/:id` | Update status / priority / assignee |
| `DELETE` | `/api/messages/:id` | Delete a message |

The SQLite database is created at `server/data/intake.db` on first run and
seeded with sample messages. Override with the `DB_PATH` env var.
