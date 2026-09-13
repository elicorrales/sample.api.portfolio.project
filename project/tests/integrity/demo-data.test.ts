import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { msUntilNextReset, resetDemoUsers, seedDemoUsersIfEmpty } from "../../api/src/demo/demo-data.ts";
import { DEMO_USERS } from "../../api/src/demo/demo-users.ts";
import { PgUsersRepository } from "../../api/src/users/users.repository.pg.ts";
import { userInputSchema } from "../../api/src/users/users.schema.ts";
import { api } from "../helpers/api.ts";
import { testDatabase } from "../helpers/database.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser, userInput } from "../helpers/users.ts";

// E. The hosted demo's data. It starts with 50 fake users and goes back to exactly those every night,
// so the demo never needs anyone to clean it up. A reset is all or nothing.

const repository = () => new PgUsersRepository(testDatabase);
const demoEmails = DEMO_USERS.map(({ input }) => input.email).sort();

// Every stored user, deleted ones included, in the basic view.
async function allUsers() {
  const res = await api().get("/v1/users?includeDeleted=true&pageSize=100").set("Authorization", `Bearer ${await adminToken()}`);
  return res.body;
}

describe("integrity: demo data", () => {
  it("E1. 50 starting users, 5 of them deleted, unique emails, and every one passes create's own validation", () => {
    expect(DEMO_USERS).toHaveLength(50);
    expect(DEMO_USERS.filter(({ deleted }) => deleted)).toHaveLength(5);
    expect(new Set(demoEmails.map((email) => email.toLowerCase())).size).toBe(50);
    for (const { input } of DEMO_USERS) {
      expect(input.email).toMatch(/@example\.com$/);
      const result = userInputSchema.safeParse(input);
      expect(result.success, `${input.email}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  it("E2. an empty database → the starting users are added: 45 listed over 3 pages, 50 with deleted ones", async () => {
    expect(await seedDemoUsersIfEmpty(repository())).toBe(true);

    const listed = await api().get("/v1/users").set("Authorization", `Bearer ${await adminToken()}`);
    expect(listed.body.totalItems).toBe(45);
    expect(listed.body.totalPages).toBe(3);
    expect((await allUsers()).totalItems).toBe(50);
  });

  it("E3. one user already there, even a deleted one → nothing is added", async () => {
    const client = api();
    const user = await createUser(client);
    await client.delete(`/v1/users/${user.id}`).set("Authorization", `Bearer ${await adminToken()}`).set("If-Match", '"1"');

    expect(await seedDemoUsersIfEmpty(repository())).toBe(false);

    expect((await allUsers()).totalItems).toBe(1);
  });

  it("E4. after a visitor's changes, the reset brings back exactly the starting users", async () => {
    await seedDemoUsersIfEmpty(repository());
    const client = api();
    const auth = `Bearer ${await adminToken()}`;
    const [first, second] = (await client.get("/v1/users").set("Authorization", auth)).body.items;
    await createUser(client, { email: "visitor@example.com" });
    await client
      .put(`/v1/users/${first.id}`)
      .set("Authorization", auth)
      .set("If-Match", '"1"')
      .send(userInput({ email: first.email, firstName: "Vandalized" }));
    await client.delete(`/v1/users/${second.id}`).set("Authorization", auth).set("If-Match", '"1"');

    await resetDemoUsers(repository());

    const all = await allUsers();
    expect(all.items.map((user: { email: string }) => user.email).sort()).toEqual(demoEmails);
    expect(all.items.map((user: { firstName: string }) => user.firstName)).not.toContain("Vandalized");
    const listed = await client.get("/v1/users").set("Authorization", auth);
    expect(listed.body.totalItems).toBe(45);
  });

  it("E5. a reset that fails midway → the data before it is untouched", async () => {
    const client = api();
    const auth = `Bearer ${await adminToken()}`;
    const kept = await createUser(client, { email: "kept@example.com" });

    // A trigger, added only for this test, refuses the 30th starting user, after the tables were emptied.
    const thirtieth = DEMO_USERS[29].input.email;
    await testDatabase.execute(sql`
      CREATE FUNCTION refuse_thirtieth() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'test fault: refused a starting user';
      END $$`);
    await testDatabase.execute(
      sql.raw(`CREATE TRIGGER refuse_thirtieth BEFORE INSERT ON users FOR EACH ROW WHEN (NEW.email = '${thirtieth}') EXECUTE FUNCTION refuse_thirtieth()`),
    );
    try {
      await expect(resetDemoUsers(repository())).rejects.toThrow();
    } finally {
      await testDatabase.execute(sql`DROP TRIGGER refuse_thirtieth ON users`);
      await testDatabase.execute(sql`DROP FUNCTION refuse_thirtieth`);
    }

    const all = await allUsers();
    expect(all.items.map((user: { email: string }) => user.email)).toEqual(["kept@example.com"]);
    const now = await client.get(`/v1/users/${kept.id}?view=detailed`).set("Authorization", auth);
    expect(now.body).toEqual(kept); // phones and addresses too
  });

  it.each([
    ["07:59:59", 1000],
    ["08:00:00", 24 * 3600 * 1000],
    ["09:00:00", 23 * 3600 * 1000],
    ["23:30:00", 8.5 * 3600 * 1000],
  ])("E6. at %s UTC, the next reset is %i ms away", (time, ms) => {
    expect(msUntilNextReset(new Date(`2026-09-13T${time}Z`))).toBe(ms);
  });
});
