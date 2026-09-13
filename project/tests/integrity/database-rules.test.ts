import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { testDatabase } from "../helpers/database.ts";
import { createUser } from "../helpers/users.ts";

// D. The database's own rules: the last line of defense if the code ever lets bad data through.
// An exception to "through the API only": the API can't send this data (Zod and the service stop it
// first), so these tests write to the database directly with SQL.

// PostgreSQL error codes: 23505 = unique violation, 23514 = check violation.
async function expectRefused(query: Promise<unknown>, code: "23505" | "23514") {
  const error: { code?: string; cause?: { code?: string } } = await query.then(
    () => ({}),
    (thrown) => thrown,
  );
  expect(error.code ?? error.cause?.code, "the database should have refused this").toBe(code);
}

describe("integrity: the database's own rules", () => {
  it("D1. a second primary phone for the same user is refused", async () => {
    const ann = await createUser(api()); // one mobile phone, primary
    await expectRefused(
      testDatabase.execute(sql`INSERT INTO user_phones (user_id, type, number, is_primary) VALUES (${ann.id}, 'home', '+13055552222', true)`),
      "23505",
    );
  });

  it("D2. a second mobile phone for the same user is refused", async () => {
    const ann = await createUser(api());
    await expectRefused(
      testDatabase.execute(sql`INSERT INTO user_phones (user_id, type, number, is_primary) VALUES (${ann.id}, 'mobile', '+13055552222', false)`),
      "23505",
    );
  });

  it("D3. a phone type that isn't mobile, home, or work is refused", async () => {
    const ann = await createUser(api());
    await expectRefused(
      testDatabase.execute(sql`INSERT INTO user_phones (user_id, type, number, is_primary) VALUES (${ann.id}, 'fax', '+13055552222', false)`),
      "23514",
    );
  });

  it("D4. an email that differs only in case is refused", async () => {
    await createUser(api(), { email: "ann@example.com" });
    await expectRefused(
      testDatabase.execute(sql`
        INSERT INTO users (id, first_name, last_name, email, date_of_birth, version, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Ann', 'Other', 'ANN@Example.com', '1990-01-01', 1, now(), now())`),
      "23505",
    );
  });
});
