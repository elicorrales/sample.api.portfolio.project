import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser } from "../helpers/users.ts";

describe("GET /v1/users/{userId}", () => {
  it("returns the basic view by default", async () => {
    const client = api();
    const created = await createUser(client, { firstName: "Ann", lastName: "Nguyen", email: "ann@example.com" });

    const res = await client.get(`/v1/users/${created.id}`).set("Authorization", `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.headers.etag).toBe('"1"');
    // Only these four fields: no date of birth, phones, addresses, version, or timestamps.
    expect(res.body).toEqual({ id: created.id, firstName: "Ann", lastName: "Nguyen", email: "ann@example.com" });
  });

  it("returns the detailed view, matching what create returned", async () => {
    const client = api();
    const created = await createUser(client);

    const res = await client
      .get(`/v1/users/${created.id}?view=detailed`)
      .set("Authorization", `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.headers.etag).toBe('"1"');
    expect(res.body).toEqual(created);
  });
});
