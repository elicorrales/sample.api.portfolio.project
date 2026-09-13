import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser, userInput } from "../helpers/users.ts";

// B. One user's save never touches another user. A missing `WHERE user_id = ...` when replacing
// phones would wipe everyone's; these tests would catch it.

const phones = [
  { number: "3055551111", type: "mobile", primary: true },
  { number: "3055552222", type: "home", primary: false },
];
const addresses = [
  { street: "1 Main St", city: "Miami", state: "FL", zip: "33101", type: "home", primary: true },
  { street: "2 Work Ave", city: "Miami", state: "FL", zip: "33102", type: "work", primary: false },
];

describe("integrity: one user's save never touches another", () => {
  it("B1. updating A's phones and addresses leaves B's unchanged", async () => {
    const client = api();
    const auth = `Bearer ${await adminToken()}`;
    const ann = await createUser(client, { email: "ann@example.com", phones, addresses });
    const bob = await createUser(client, { email: "bob@example.com", phones, addresses });

    const res = await client
      .put(`/v1/users/${ann.id}`)
      .set("Authorization", auth)
      .set("If-Match", '"1"')
      .send(
        userInput({
          email: "ann@example.com",
          phones: [{ number: "7865559999", type: "work" }],
          addresses: [{ street: "9 New Rd", city: "Tampa", state: "FL", zip: "33601", type: "mailing" }],
        }),
      );
    expect(res.status).toBe(200);

    const bobNow = await client.get(`/v1/users/${bob.id}?view=detailed`).set("Authorization", auth);
    expect(bobNow.body).toEqual(bob);
  });

  it("B2. deleting and restoring A leaves B unchanged and listed", async () => {
    const client = api();
    const auth = `Bearer ${await adminToken()}`;
    const ann = await createUser(client, { email: "ann@example.com", phones, addresses });
    const bob = await createUser(client, { email: "bob@example.com", phones, addresses });

    expect((await client.delete(`/v1/users/${ann.id}`).set("Authorization", auth).set("If-Match", '"1"')).status).toBe(204);
    const whileDeleted = await client.get("/v1/users").set("Authorization", auth);
    expect(whileDeleted.body.items.map((user: { id: string }) => user.id)).toEqual([bob.id]);

    expect((await client.post(`/v1/users/${ann.id}/restore`).set("Authorization", auth)).status).toBe(200);
    const bobNow = await client.get(`/v1/users/${bob.id}?view=detailed`).set("Authorization", auth);
    expect(bobNow.body).toEqual(bob);
    const list = await client.get("/v1/users").set("Authorization", auth);
    expect(list.body.totalItems).toBe(2);
  });
});
