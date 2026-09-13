import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser, userInput } from "../helpers/users.ts";

const twoPhones = [
  { number: "3055550001", type: "mobile", primary: true },
  { number: "3055550002", type: "home", primary: false },
];

describe("PUT /v1/users/{userId}", () => {
  it("replaces the whole user and bumps the version", async () => {
    const client = api();
    const created = await createUser(client, { lastName: "Nguyen", email: "ann@example.com", phones: twoPhones });

    // Same email (must not conflict with itself). Mobile left out; work added; primary moves to home.
    const edited = userInput({
      lastName: "Nguyen-Smith",
      email: "ann@example.com",
      phones: [
        { number: "3055550003", type: "work", primary: false },
        { number: "3055550002", type: "home", primary: true },
      ],
    });

    const res = await client
      .put(`/v1/users/${created.id}`)
      .set("Authorization", `Bearer ${await adminToken()}`)
      .set("If-Match", '"1"')
      .send(edited);

    expect(res.status).toBe(200);
    expect(res.headers.etag).toBe('"2"');
    expect(res.body).toMatchObject({
      id: created.id,
      lastName: "Nguyen-Smith",
      email: "ann@example.com",
      phones: [
        { number: "+13055550002", type: "home", primary: true },
        { number: "+13055550003", type: "work", primary: false },
      ],
      version: 2,
      createdAt: created.createdAt,
    });

    // The change was saved, not just echoed back.
    const reloaded = await client
      .get(`/v1/users/${created.id}?view=detailed`)
      .set("Authorization", `Bearer ${await adminToken()}`);
    expect(reloaded.body).toEqual(res.body);
  });

  it("makes the only remaining phone primary when an edit leaves just one", async () => {
    const client = api();
    const created = await createUser(client, { phones: twoPhones });

    const res = await client
      .put(`/v1/users/${created.id}`)
      .set("Authorization", `Bearer ${await adminToken()}`)
      .set("If-Match", '"1"')
      .send(userInput({ email: created.email, phones: [{ number: "3055550002", type: "home" }] }));

    expect(res.status).toBe(200);
    expect(res.body.phones).toEqual([{ number: "+13055550002", type: "home", primary: true }]);
  });
});
