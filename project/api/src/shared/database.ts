import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

// Stage 3 of the database path (decision 03): a real PostgreSQL server.
// This file only connects. On the laptop, `embedded-postgres` runs the server (tests and `npm run dev`);
// when hosted, the host does. Either way the API just needs DATABASE_URL.

const migrationsFolder = fileURLToPath(new URL("../../migrations", import.meta.url));

// Connects and applies any migrations the database hasn't had yet.
export async function openDatabase(connectionString: string) {
  const db = drizzle({ client: new pg.Pool({ connectionString }) });
  await migrate(db, { migrationsFolder });
  return db;
}

export type Database = Awaited<ReturnType<typeof openDatabase>>;
