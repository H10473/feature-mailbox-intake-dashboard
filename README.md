# feature-mailbox-intake-dashboard

A **Mailbox Intake Dashboard** built for the transactional intake mailbox
`FAHQ-RA-GOFlexBLRTransactional@firstam.com`. It measures operational KPIs and
tracks the aging of incoming emails against SLA targets, using the data
available from the mailbox (received time, first response time, resolution
time, volume, etc.).

## What it tracks

- **Volume & trends** — daily received vs. resolved counts over the last 14 days.
- **First response time** — minutes from email received → first response.
- **Handle time** — minutes from received → completion.
- **SLA compliance**
  - **Acknowledge SLA:** first response within **15 minutes**.
  - **Completion SLA:** fully resolved within **4 hours**.
- **Aging** — open emails bucketed by how long they have been waiting
  (`≤15m`, `15m–1h`, `1h–4h`, `>4h breached`).
- **Volume heatmap** — received volume by day-of-week × hour-of-day.
- **Mailbox folder** — the folder each email sits in (`Inbox`, `Processing`,
  `Completed`, `Escalations`), plus a direct **Open** link to the message in
  Outlook (`webLink`).

SLA thresholds and the mailbox address are configurable via env vars
(`MAILBOX_ADDRESS`, `ACK_SLA_MINUTES`, `COMPLETION_SLA_MINUTES`).

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite (`client/`)
- **Backend:** Express + TypeScript + SQLite (`better-sqlite3`) (`server/`)
- **Monorepo:** npm workspaces

## Getting started

```bash
npm install      # install all workspace dependencies
npm run dev      # start API (:4000) + Vite dev server (:5173)
```

Then open http://localhost:5173. On first run the database is created at
`server/data/intake.db` and seeded with ~90 representative emails spread across
14 days so the KPIs, trends, and aging views are populated.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run backend + frontend in watch mode |
| `npm run build` | Type-check and build both packages |
| `npm run lint` | Lint both packages |
| `npm test` | Run backend tests (Vitest + Supertest) |

## API

Base URL: `http://localhost:4000`

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/config` | Mailbox address + SLA thresholds |
| `GET` | `/api/kpis` | Volume, avg response/handle time, SLA compliance, breaches |
| `GET` | `/api/aging` | Open emails bucketed by age |
| `GET` | `/api/trends?days=14` | Daily received/resolved + response/SLA trend |
| `GET` | `/api/heatmap` | Received volume by day-of-week × hour-of-day |
| `GET` | `/api/messages?status=` | List emails (with derived SLA fields) |
| `POST` | `/api/messages` | Log an incoming email |
| `POST` | `/api/messages/:id/acknowledge` | Record first response (starts SLA clock stop) |
| `POST` | `/api/messages/:id/complete` | Mark email resolved |
| `PATCH` | `/api/messages/:id` | Update status / priority / assignee |
| `DELETE` | `/api/messages/:id` | Delete an email |

## Live mailbox ingestion

The dashboard currently runs on seeded/representative data. To ingest from the
live Microsoft 365 mailbox, wire a Microsoft Graph connector that maps each
message to the `messages` schema (`receivedAt`, `firstResponseAt`, `resolvedAt`,
etc.). This requires Azure AD app credentials (tenant ID, client ID, client
secret) with `Mail.Read` permission on the mailbox — supply these as
environment secrets before enabling live sync.
