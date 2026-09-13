import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser, userInput } from "../helpers/users.ts";

async function deleteUser(client: ReturnType<typeof api>, id: string, version: string) {
  return client.delete(`/v1/users/${id}`).set("Authorization", `Bearer ${await adminToken()}`).set("If-Match", version);
}

describe("DELETE /v1/users/{userId}", () => {
  it("deletes the user and hides it from get and list", async () => {
    const client = api();
    const kept = await createUser(client, { lastName: "Adams" });
    const deleted = await createUser(client, { lastName: "Baker" });

    const res = await deleteUser(client, deleted.id, '"1"');

    expect(res.status).toBe(204);
    expect(res.text).toBe("");

    const token = `Bearer ${await adminToken()}`;
    const get = await client.get(`/v1/users/${deleted.id}`).set("Authorization", token);
    expect(get.status).toBe(404);

    const list = await client.get("/v1/users").set("Authorization", token);
    expect(list.body.items.map((user: { id: string }) => user.id)).toEqual([kept.id]);
    expect(list.body.totalItems).toBe(1);
  });

  it("still shows a deleted user when includeDeleted=true, with deletedAt", async () => {
    const client = api();
    const kept = await createUser(client, { lastName: "Adams" });
    const deleted = await createUser(client, { lastName: "Baker" });
    await deleteUser(client, deleted.id, '"1"');
    const token = `Bearer ${await adminToken()}`;

    const get = await client.get(`/v1/users/${deleted.id}?view=detailed&includeDeleted=true`).set("Authorization", token);
    expect(get.status).toBe(200);
    // Delete is a change, so the version went up.
    expect(get.headers.etag).toBe('"2"');
    expect(get.body).toMatchObject({ id: deleted.id, version: 2, deletedAt: expect.any(String) });
    expect(Number.isNaN(Date.parse(get.body.deletedAt))).toBe(false);

    const list = await client.get("/v1/users?includeDeleted=true").set("Authorization", token);
    expect(list.body.items).toEqual([
      { id: kept.id, firstName: kept.firstName, lastName: "Adams", email: kept.email, deletedAt: null },
      { id: deleted.id, firstName: deleted.firstName, lastName: "Baker", email: deleted.email, deletedAt: get.body.deletedAt },
    ]);
  });

  it("can't update a deleted user (restore first)", async () => {
    const client = api();
    const deleted = await createUser(client);
    await deleteUser(client, deleted.id, '"1"');

    const res = await client
      .put(`/v1/users/${deleted.id}`)
      .set("Authorization", `Bearer ${await adminToken()}`)
      .set("If-Match", '"2"')
      .send(userInput({ email: deleted.email }));

    expect(res.status).toBe(404);
  });
});
