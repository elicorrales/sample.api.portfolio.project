import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { adminToken } from "../helpers/tokens.ts";
import { userInput } from "../helpers/users.ts";

// One admin's session on one user, the way the web page will drive the API:
// each save sends back the ETag from the step before.
describe("admin session: create → list → get → edit → delete → restore", () => {
  it("keeps the user and every edit consistent across the whole cycle", async () => {
    const client = api();
    const auth = `Bearer ${await adminToken()}`;
    const ann = userInput({ firstName: "Ann", lastName: "Nguyen", email: "ann.nguyen@example.com" });

    // 1. Create
    const created = await client.post("/v1/users").set("Authorization", auth).send(ann);
    expect(created.status).toBe(201);
    const id = created.body.id;
    let etag = created.headers.etag;
    expect(etag).toBe('"1"');

    // 2. Find her in the list
    const found = await client.get("/v1/users?search=ann").set("Authorization", auth);
    expect(found.body.items.map((user: { id: string }) => user.id)).toEqual([id]);

    // 3. Open her detail page
    const loaded = await client.get(`/v1/users/${id}?view=detailed`).set("Authorization", auth);
    expect(loaded.body).toEqual(created.body);
    expect(loaded.headers.etag).toBe(etag);
    etag = loaded.headers.etag;

    // 4. Edit: add a work phone and make it primary
    const edited = await client
      .put(`/v1/users/${id}`)
      .set("Authorization", auth)
      .set("If-Match", etag)
      .send({
        ...ann,
        phones: [
          { number: "3055551234", type: "mobile", primary: false },
          { number: "3055559999", type: "work", primary: true },
        ],
      });
    expect(edited.status).toBe(200);
    etag = edited.headers.etag;
    expect(etag).toBe('"2"');

    // 5. Delete, using the ETag from the edit
    const deleted = await client.delete(`/v1/users/${id}`).set("Authorization", auth).set("If-Match", etag);
    expect(deleted.status).toBe(204);

    // 6. Gone from the list
    const afterDelete = await client.get("/v1/users?search=ann").set("Authorization", auth);
    expect(afterDelete.body.items).toEqual([]);

    // 7. Restore. Versions so far: create 1 → edit 2 → delete 3 → restore 4.
    const restored = await client.post(`/v1/users/${id}/restore`).set("Authorization", auth);
    expect(restored.status).toBe(200);
    expect(restored.headers.etag).toBe('"4"');
    expect(restored.body.phones[0]).toEqual({ number: "+13055559999", type: "work", primary: true });

    // 8. Back in the list, with the edit from step 4 intact
    const afterRestore = await client.get("/v1/users?search=ann").set("Authorization", auth);
    expect(afterRestore.body.items.map((user: { id: string }) => user.id)).toEqual([id]);
    const final = await client.get(`/v1/users/${id}?view=detailed`).set("Authorization", auth);
    expect(final.body).toEqual(restored.body);
    expect(final.body.phones).toEqual(edited.body.phones);
  });
});
