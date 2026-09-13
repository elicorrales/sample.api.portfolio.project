import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../helpers/api.ts";
import { testDatabase } from "../helpers/database.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser, userInput } from "../helpers/users.ts";

// C. A save that fails partway changes nothing. A PostgreSQL trigger, added only for these tests,
// makes the database refuse any address in "Failtown". Users and phones are saved before addresses,
// so the failure lands in the middle of the save, and the transaction must undo the first part.

const failtown = { street: "1 Main St", city: "Failtown", state: "FL", zip: "33101", type: "home" };

describe("integrity: a save that fails partway changes nothing", () => {
  beforeAll(async () => {
    await testDatabase.execute(sql`
      CREATE FUNCTION refuse_failtown() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'test fault: address in Failtown';
      END $$`);
    await testDatabase.execute(sql`
      CREATE TRIGGER refuse_failtown BEFORE INSERT ON user_addresses
      FOR EACH ROW WHEN (NEW.city = 'Failtown') EXECUTE FUNCTION refuse_failtown()`);
  });

  afterAll(async () => {
    await testDatabase.execute(sql`DROP TRIGGER refuse_failtown ON user_addresses`);
    await testDatabase.execute(sql`DROP FUNCTION refuse_failtown`);
  });

  beforeEach(() => {
    // The server logs the database error (for us); the test keeps it out of its output.
    vi.spyOn(console, "error").mockImplementation(() => {});
    return () => vi.restoreAllMocks();
  });

  it("C1. an update that fails while saving addresses → 500, and the user is exactly as before", async () => {
    const client = api();
    const auth = `Bearer ${await adminToken()}`;
    const ann = await createUser(client, {
      email: "ann@example.com",
      phones: [
        { number: "3055551111", type: "mobile", primary: true },
        { number: "3055552222", type: "home", primary: false },
      ],
    });

    const res = await client
      .put(`/v1/users/${ann.id}`)
      .set("Authorization", auth)
      .set("If-Match", '"1"')
      .send(userInput({ email: "ann@example.com", firstName: "Changed", phones: [{ number: "7865559999", type: "work" }], addresses: [failtown] }));
    expect(res.status).toBe(500);

    // Name, version, phones (deleted and re-inserted before the failure), and addresses: all unchanged.
    const now = await client.get(`/v1/users/${ann.id}?view=detailed`).set("Authorization", auth);
    expect(now.headers.etag).toBe('"1"');
    expect(now.body).toEqual(ann);
  });

  it("C2. a create that fails while saving addresses → 500, no half-saved user, and the email is still free", async () => {
    const client = api();
    const auth = `Bearer ${await adminToken()}`;

    const res = await client.post("/v1/users").set("Authorization", auth).send(userInput({ email: "ann@example.com", addresses: [failtown] }));
    expect(res.status).toBe(500);

    const list = await client.get("/v1/users?includeDeleted=true").set("Authorization", auth);
    expect(list.body.totalItems).toBe(0);
    const retry = await client.post("/v1/users").set("Authorization", auth).send(userInput({ email: "ann@example.com" }));
    expect(retry.status).toBe(201);
  });
});
