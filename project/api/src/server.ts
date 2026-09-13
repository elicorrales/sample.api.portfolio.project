import { createApp } from "./app.ts";
import { scheduleNightlyReset, seedDemoUsersIfEmpty } from "./demo/demo-data.ts";
import { openDatabase } from "./shared/database.ts";
import { readSettings, type Settings, SettingsError } from "./shared/settings.ts";
import { PgUsersRepository } from "./users/users.repository.pg.ts";

// No fallback secret or database: a server that starts without them would accept tokens signed with a
// guessable key, or hide a missing setting when hosted. readSettings lists every problem at once.
let settings: Settings;
try {
  settings = readSettings(process.env);
} catch (error) {
  if (!(error instanceof SettingsError)) throw error;
  console.error(`${error.message}\nFor local development, use \`npm run dev\`.`);
  process.exit(1);
}
const { jwtSecret, databaseUrl, port, corsOrigins, trustProxy, demoMode, maxUsers } = settings;

const db = await openDatabase(databaseUrl);
const usersRepository = new PgUsersRepository(db);

// The demo looks after its own data: starting users on a first start, and a reset every night at 08:00 UTC.
let stopNightlyReset = () => {};
if (demoMode) {
  const seeded = await seedDemoUsersIfEmpty(usersRepository);
  console.log(seeded ? "Demo: added the 50 starting users" : "Demo: users already exist; starting users not added");
  stopNightlyReset = scheduleNightlyReset(usersRepository);
}

const server = createApp({ jwtSecret, corsOrigins, trustProxy, maxUsers, demoMode, usersRepository }).listen(port, () => {
  const { host, pathname } = new URL(databaseUrl); // printed without the password
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Docs: http://localhost:${port}/docs`);
  console.log(`CORS allowed origins: ${corsOrigins.join(", ") || "(none)"}`);
  console.log(`Database: ${host}${pathname}`);
  console.log(`Trust proxy hops: ${trustProxy} · Demo mode: ${demoMode ? "on" : "off"} · User limit: ${maxUsers ?? "none"}`);
});

// On Ctrl+C or a restart: stop taking requests, then close the database connections.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    stopNightlyReset();
    server.close();
    void db.$client.end().then(() => process.exit(0));
  });
}
