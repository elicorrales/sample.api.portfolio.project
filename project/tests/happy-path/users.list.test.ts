import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser } from "../helpers/users.ts";

async function list(client: ReturnType<typeof api>, query = "") {
  return client.get(`/v1/users${query}`).set("Authorization", `Bearer ${await adminToken()}`);
}

describe("GET /v1/users", () => {
  it("lists users in the basic view, sorted by last name (ignoring case), then first name", async () => {
    const client = api();
    await createUser(client, { firstName: "Ann", lastName: "Nguyen", email: "ann@example.com" });
    await createUser(client, { firstName: "Zoe", lastName: "Adams", email: "zoe@example.com" });
    await createUser(client, { firstName: "Amy", lastName: "adams", email: "amy@example.com" });

    const res = await list(client);

    expect(res.status).toBe(200);
    // Basic view only: no date of birth, phones, addresses, version, or timestamps.
    expect(res.body).toEqual({
      items: [
        { id: expect.any(String), firstName: "Amy", lastName: "adams", email: "amy@example.com" },
        { id: expect.any(String), firstName: "Zoe", lastName: "Adams", email: "zoe@example.com" },
        { id: expect.any(String), firstName: "Ann", lastName: "Nguyen", email: "ann@example.com" },
      ],
      page: 1,
      pageSize: 20,
      totalItems: 3,
      totalPages: 1,
    });
  });

  it("searches first name, last name, and email: partial match, ignoring case", async () => {
    const client = api();
    await createUser(client, { lastName: "Smith", email: "a@example.com" });
    await createUser(client, { lastName: "Blacksmith", email: "b@example.com" });
    await createUser(client, { lastName: "Jones", email: "asmith@example.com" });
    await createUser(client, { firstName: "Smitty", lastName: "Brown", email: "c@example.com" });
    await createUser(client, { lastName: "Lee", email: "d@example.com" });

    const res = await list(client, "?search=SMI");

    expect(res.status).toBe(200);
    expect(res.body.items.map((user: { lastName: string }) => user.lastName)).toEqual([
      "Blacksmith",
      "Brown",
      "Jones",
      "Smith",
    ]);
    expect(res.body.totalItems).toBe(4);
  });

  it("sorts by email, descending", async () => {
    const client = api();
    await createUser(client, { email: "mia@example.com" });
    await createUser(client, { email: "Zed@example.com" });
    await createUser(client, { email: "amy@example.com" });

    const res = await list(client, "?sort=email&order=desc");

    expect(res.status).toBe(200);
    expect(res.body.items.map((user: { email: string }) => user.email)).toEqual([
      "Zed@example.com",
      "mia@example.com",
      "amy@example.com",
    ]);
  });

  it("pages through results", async () => {
    const client = api();
    await createUser(client, { lastName: "Adams" });
    await createUser(client, { lastName: "Baker" });
    await createUser(client, { lastName: "Clark" });

    const res = await list(client, "?page=2&pageSize=2");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 2, pageSize: 2, totalItems: 3, totalPages: 2 });
    expect(res.body.items.map((user: { lastName: string }) => user.lastName)).toEqual(["Clark"]);
  });

  it("returns an empty page, not an error, for a page past the end", async () => {
    const client = api();
    await createUser(client);
    await createUser(client);
    await createUser(client);

    const res = await list(client, "?page=5&pageSize=2");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], page: 5, pageSize: 2, totalItems: 3, totalPages: 2 });
  });
});
