import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeEach, inject } from "vitest";
import { openDatabase } from "../../api/src/shared/database.ts";

// One database per test file, copied from the migrated template that tests/global-setup.ts prepared
// (copying takes milliseconds), and emptied before each test, so tests never see each other's data.
// Any test file that imports this gets it.

const postgresUrl = inject("postgresUrl");
const templateDatabase = inject("templateDatabase");
const databaseName = `test_${randomUUID().replaceAll("-", "")}`;

// CREATE and DROP DATABASE run from a connection to the server's default database.
async function onServer(statement: string) {
  const client = new pg.Client({ connectionString: `${postgresUrl}/postgres` });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

await onServer(`CREATE DATABASE ${databaseName} TEMPLATE ${templateDatabase}`);
export const testDatabase = await openDatabase(`${postgresUrl}/${databaseName}`);

beforeEach(async () => {
  // CASCADE also empties user_phones and user_addresses.
  await testDatabase.execute(sql`TRUNCATE users CASCADE`);
});

afterAll(async () => {
  await testDatabase.$client.end();
  await onServer(`DROP DATABASE ${databaseName}`);
});
