# AGENTS.md

## Cursor Cloud specific instructions

This is an npm-workspaces monorepo with two packages: `server/` (Express + TypeScript +
SQLite via `better-sqlite3`) and `client/` (React + TypeScript + Vite). Standard commands
live in the root `package.json` and `README.md`; prefer those.

Non-obvious notes for running/developing here:

- **Start everything with `npm run dev` from the repo root.** It runs the API (port `4000`)
  and the Vite dev server (port `5173`) together via `concurrently`. Open the app at
  `http://localhost:5173` — not the API port.
- **The frontend has no API base URL.** It calls relative `/api/*` paths that Vite proxies
  to the backend (see `client/vite.config.ts`). If you run the client without the server,
  API calls will fail. Override the proxy target with `VITE_API_TARGET` if the API runs
  elsewhere.
- **`better-sqlite3` is a native module.** It compiles on `npm install` (needs Python + a
  C/C++ toolchain, which the base image already has). If you switch Node major versions,
  re-run `npm install` so the native binding is rebuilt for that ABI.
- **SQLite data is local and gitignored.** The DB is created and seeded at
  `server/data/intake.db` on first server start (override with `DB_PATH`; tests use an
  in-memory DB). To reset seed data, stop the server and delete `server/data/`.
- **Tests are backend-only** (`npm test` → Vitest + Supertest against the Express app with
  an in-memory SQLite DB). There is currently no frontend test suite.
- **KPI/SLA/aging/trends logic lives in `server/src/metrics.ts`** as pure functions
  (`enrich`, `computeKpis`, `computeAging`, `computeTrends`) operating on messages relative
  to a `now` date; the repository just calls them. SLA thresholds and the mailbox address
  come from `server/src/config.ts` (env-overridable: `MAILBOX_ADDRESS`, `ACK_SLA_MINUTES`,
  `COMPLETION_SLA_MINUTES`).
- **Changing the DB schema requires recreating the DB.** The schema is created once via
  `CREATE TABLE IF NOT EXISTS`; there are no migrations. After editing the schema or the
  seed generator, delete `server/data/` and restart so it re-seeds. Seed data is generated
  relative to the current time, so aging/trends stay meaningful whenever it is reseeded.
- **Data is currently seeded, not live.** Ingesting the real mailbox needs a Microsoft Graph
  connector + Azure AD credentials (`Mail.Read`); map Graph messages onto the `messages`
  table columns.
