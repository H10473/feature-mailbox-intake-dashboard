# ROI Impact Dashboard

An operations dashboard for GO-Flex that combines mailbox intake KPIs, team
rewards recognition, and automation ROI/impact summaries.

## Sections

- **Rewards** — rolling recognition for Innovator of the Quarter awardees
- **GO-Flex Business Unit** — Open Order HiveSight automation ROI brief (Q4 2025 baseline)
- **Mailbox Intake KPIs** — volume, SLA compliance, aging, trends, and heatmap
- **Inbox workflow** — acknowledge, complete, and manage incoming requests

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite (`client/`)
- **Backend:** Express + TypeScript + SQLite (`server/`)
- **Monorepo:** npm workspaces

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The API runs on http://localhost:4000.

On first run the database is created at `server/data/intake.db` and seeded with
representative mailbox data.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run backend + frontend in watch mode |
| `npm run build` | Type-check and build both packages |
| `npm run lint` | Lint both packages |
| `npm test` | Run backend tests |
