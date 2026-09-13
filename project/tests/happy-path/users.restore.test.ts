import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser } from "../helpers/users.ts";

// Creates a user with 2 phones and 2 addresses, then deletes it.
async function createDeletedUser(client: ReturnType<typeof api>) {
  const created = await createUser(client, {
    lastName: "Baker",
    phones: [
      { number: "3055550001", type: "mobile", primary: true },
      { number: "3055550002", type: "work", primary: false },
    ],
    addresses: [
      { street: "1 Home Ln", city: "Miami", state: "FL", zip: "33101", type: "home", primary: true },
      { street: "9 Mail Rd", city: "Miami", state: "FL", zip: "33103", type: "mailing", primary: false },
    ],
  });
  await client
    .delete(`/v1/users/${created.id}`)
    .set("Authorization", `Bearer ${await adminToken()}`)
    .set("If-Match", '"1"');
  return created;
}

describe("POST /v1/users/{userId}/restore", () => {
  it("restores a deleted user and returns it in the detailed view", async () => {
    const client = api();
    const created = await createDeletedUser(client);

    const res = await client.post(`/v1/users/${created.id}/restore`).set("Authorization", `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    // Create = 1, delete = 2, restore = 3.
    expect(res.headers.etag).toBe('"3"');
    const { version: _version, updatedAt: _updatedAt, ...unchanged } = created;
    expect(res.body).toMatchObject({ ...unchanged, version: 3 });
    expect(res.body).not.toHaveProperty("deletedAt");
  });

  it("makes the user visible again in get and list, with phones and addresses intact", async () => {
    const client = api();
    const other = await createUser(client, { lastName: "Adams" });
    const created = await createDeletedUser(client);
    const token = `Bearer ${await adminToken()}`;

    await client.post(`/v1/users/${created.id}/restore`).set("Authorization", token);

    const get = await client.get(`/v1/users/${created.id}?view=detailed`).set("Authorization", token);
    expect(get.status).toBe(200);
    expect(get.body.phones).toEqual(created.phones);
    expect(get.body.addresses).toEqual(created.addresses);

    const list = await client.get("/v1/users").set("Authorization", token);
    expect(list.body.items.map((user: { id: string }) => user.id)).toEqual([other.id, created.id]);
  });
});
