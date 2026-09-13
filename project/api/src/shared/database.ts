import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

// Stage 2 of the database path (decision 03): PGlite, real PostgreSQL running inside Node.
// Moving to a PostgreSQL server later changes this file, not the repository.

const migrationsFolder = fileURLToPath(new URL("../../migrations", import.meta.url));

// Opens the database and applies any migrations it hasn't had yet.
// With a folder, the data is saved there; without one, it lives in memory until the process ends.
export async function openDatabase(dataDir?: string) {
  const db = drizzle({ client: new PGlite(dataDir) });
  await migrate(db, { migrationsFolder });
  return db;
}

export type Database = Awaited<ReturnType<typeof openDatabase>>;
