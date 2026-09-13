import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { openDatabase } from "../../api/src/shared/database.ts";

// One in-memory PostgreSQL (PGlite) per test file, emptied before each test,
// so tests never see each other's data. Any test file that imports this gets it.
export const testDatabase = await openDatabase();

beforeEach(async () => {
  // CASCADE also empties user_phones and user_addresses.
  await testDatabase.execute(sql`TRUNCATE users CASCADE`);
});

afterAll(async () => {
  await testDatabase.$client.close();
});
