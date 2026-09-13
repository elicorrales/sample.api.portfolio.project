import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

// `npm run dev`: starts a local PostgreSQL server (data kept in .data/postgres), then the API with
// auto-restart on code changes. The database keeps running across those restarts; Ctrl+C stops both.
// Hosted, none of this runs: the host provides PostgreSQL and the API only needs DATABASE_URL.

const databaseDir = join(".data", "postgres");
const port = 54320;
const user = "postgres";
const password = "dev-only-password";
const database = "users_api";

const postgres = new EmbeddedPostgres({ databaseDir, port, user, password, persistent: true, onLog: () => {} });

// First run only: create the server's data folder.
if (!existsSync(join(databaseDir, "PG_VERSION"))) {
  await postgres.initialise();
}
await postgres.start();

const client = postgres.getPgClient();
await client.connect();
const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
await client.end();
if (!rowCount) {
  await postgres.createDatabase(database);
}

// Plain Node runs the TypeScript, the same way Render does (`npm start`); --watch adds the auto-restart.
const api = spawn(process.execPath, ["--watch", "api/src/server.ts"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: `postgres://${user}:${password}@localhost:${port}/${database}` },
});

// Ctrl+C reaches the API too. Wait for it to close its connections, then stop the database.
let stopping = false;
async function stopAll() {
  if (stopping) return;
  stopping = true;
  if (api.exitCode === null) {
    await new Promise((resolve) => api.once("exit", resolve));
  }
  await postgres.stop();
  process.exit(0);
}
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
api.once("exit", stopAll);
