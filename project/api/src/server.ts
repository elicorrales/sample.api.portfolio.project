import { createApp } from "./app.ts";
import { openDatabase } from "./shared/database.ts";
import { PgUsersRepository } from "./users/users.repository.pg.ts";

const port = Number(process.env.PORT ?? 3000);

// No fallback secret: a server that starts without one would accept tokens signed with a guessable key.
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error("JWT_SECRET is not set. For local development, use `npm run dev`.");
  process.exit(1);
}

const corsOrigins = (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean);

// A folder keeps the data between restarts. Without one, the data is in memory and lost when the server stops.
const dataDir = process.env.DATA_DIR;
const db = await openDatabase(dataDir);

const server = createApp({ jwtSecret, corsOrigins, usersRepository: new PgUsersRepository(db) }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`CORS allowed origins: ${corsOrigins.join(", ") || "(none)"}`);
  console.log(`Data: ${dataDir ? `saved in ${dataDir}` : "in memory (lost on stop)"}`);
});

// Close the database cleanly on Ctrl+C or a restart, so its files are never left half-written.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close();
    void db.$client.close().then(() => process.exit(0));
  });
}
