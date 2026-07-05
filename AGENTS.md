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
