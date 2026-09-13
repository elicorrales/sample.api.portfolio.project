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

// No fallback database either: silently using some default would hide a missing setting when hosted.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. For local development, use `npm run dev`.");
  process.exit(1);
}

const corsOrigins = (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean);

const db = await openDatabase(databaseUrl);

const server = createApp({ jwtSecret, corsOrigins, usersRepository: new PgUsersRepository(db) }).listen(port, () => {
  const { host, pathname } = new URL(databaseUrl); // printed without the password
  console.log(`API listening on http://localhost:${port}`);
  console.log(`CORS allowed origins: ${corsOrigins.join(", ") || "(none)"}`);
  console.log(`Database: ${host}${pathname}`);
});

// On Ctrl+C or a restart: stop taking requests, then close the database connections.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close();
    void db.$client.end().then(() => process.exit(0));
  });
}
