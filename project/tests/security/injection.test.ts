import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { expectProblem } from "../helpers/problems.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser } from "../helpers/users.ts";

// C. Injection. Input is only ever data, never part of a query or code. Storage is in memory
// today; these tests are here for when it becomes PostgreSQL, where they start to matter.

describe("security: injection", () => {
  it.each([
    ["% (a SQL LIKE wildcard for any text)", "%"],
    ["_ (a SQL LIKE wildcard for one character)", "_"],
    ["a classic SQL injection", "' OR '1'='1"],
  ])("C1. search with %s matches only itself", async (_name, search) => {
    const client = api();
    await createUser(client, { firstName: "Ann", lastName: "Smith" });
    await createUser(client, { firstName: "Bob", lastName: "Jones" });

    const res = await client
      .get(`/v1/users?search=${encodeURIComponent(search)}`)
      .set("Authorization", `Bearer ${await adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(0);
  });

  it.each([
    ["sort", "lastName; DROP TABLE users"],
    ["sort", "lastName, password"],
    ["order", "asc --"],
  ])("C2. %s=%s is rejected (only values from the allowed list)", async (field, value) => {
    const res = await api()
      .get(`/v1/users?${field}=${encodeURIComponent(value)}`)
      .set("Authorization", `Bearer ${await adminToken()}`);
    expectProblem(res, 400, field);
  });

  it("C3. an id with SQL in it is rejected", async () => {
    const res = await api()
      .get(`/v1/users/${encodeURIComponent("1' OR '1'='1")}`)
      .set("Authorization", `Bearer ${await adminToken()}`);
    expectProblem(res, 400, "userId");
  });

  it("C4. __proto__ in the body is rejected, and nothing is polluted", async () => {
    // Sent as raw text: a JavaScript object literal would treat __proto__ as its prototype, not a field.
    const res = await api()
      .post("/v1/users")
      .set("Authorization", `Bearer ${await adminToken()}`)
      .set("Content-Type", "application/json")
      .send('{"firstName": "Ann", "__proto__": {"role": "admin"}}');
    expectProblem(res, 400);
    expect(({} as Record<string, unknown>).role).toBeUndefined();
  });
});
