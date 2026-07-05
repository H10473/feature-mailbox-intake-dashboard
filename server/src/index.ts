import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createApp } from "./app.js";
import { createDb, seedIfEmpty } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 4000);
const DB_PATH = process.env.DB_PATH ?? join(__dirname, "..", "data", "intake.db");

const db = createDb(DB_PATH);
seedIfEmpty(db);

const app = createApp(db);
app.listen(PORT, () => {
  console.log(`[server] Mailbox Intake API listening on http://localhost:${PORT}`);
  console.log(`[server] Using database: ${DB_PATH}`);
});
