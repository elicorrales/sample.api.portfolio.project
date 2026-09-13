import request from "supertest";
import { describe, expect, it } from "vitest";
import { api, testApp } from "../helpers/api.ts";
import { expectProblem } from "../helpers/problems.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser, userInput } from "../helpers/users.ts";

// E. Conflicts (409).

describe("bad calls: conflicts", () => {
  it("E1. create with an existing email, in different case", async () => {
    const client = api();
    await createUser(client, { email: "ann@example.com" });

    const res = await client
      .post("/v1/users")
      .set("Authorization", `Bearer ${await adminToken()}`)
      .send(userInput({ email: "ANN@Example.com" }));

    expectProblem(res, 409);
  });

  it("E2. create with a deleted user's email suggests restoring", async () => {
    const client = api();
    const token = `Bearer ${await adminToken()}`;
    const deleted = await createUser(client, { email: "ann@example.com" });
    await client.delete(`/v1/users/${deleted.id}`).set("Authorization", token).set("If-Match", '"1"');

    const res = await client.post("/v1/users").set("Authorization", token).send(userInput({ email: "ann@example.com" }));

    expectProblem(res, 409);
    expect(res.body.detail).toMatch(/restore/i);
  });

  it("E3. update email to another user's", async () => {
    const client = api();
    await createUser(client, { email: "ann@example.com" });
    const bob = await createUser(client, { email: "bob@example.com" });

    const res = await client
      .put(`/v1/users/${bob.id}`)
      .set("Authorization", `Bearer ${await adminToken()}`)
      .set("If-Match", '"1"')
      .send(userInput({ email: "ann@example.com" }));

    expectProblem(res, 409);
  });

  it("E4. restore a user who isn't deleted", async () => {
    const client = api();
    const user = await createUser(client);

    const res = await client.post(`/v1/users/${user.id}/restore`).set("Authorization", `Bearer ${await adminToken()}`);

    expectProblem(res, 409);
  });

  describe("user limit (3 here; 200 on the hosted demo)", () => {
    const limitedClient = () => request(testApp({ maxUsers: 3 }));

    it("E5. 3 users, one of them deleted → the 4th create gets 409 user-limit, and nothing is saved", async () => {
      const client = limitedClient();
      const token = `Bearer ${await adminToken()}`;
      await createUser(client);
      await createUser(client);
      const deleted = await createUser(client);
      await client.delete(`/v1/users/${deleted.id}`).set("Authorization", token).set("If-Match", '"1"');

      const res = await client.post("/v1/users").set("Authorization", token).send(userInput());

      expectProblem(res, 409);
      expect(res.body.type).toBe("/problems/user-limit");
      const all = await client.get("/v1/users?includeDeleted=true").set("Authorization", token);
      expect(all.body.totalItems).toBe(3);
    });

    it("E6. at the limit, update, delete, and restore still work (they add no users)", async () => {
      const client = limitedClient();
      const token = `Bearer ${await adminToken()}`;
      const ann = await createUser(client);
      const bob = await createUser(client);
      await createUser(client);

      const updated = await client
        .put(`/v1/users/${ann.id}`)
        .set("Authorization", token)
        .set("If-Match", '"1"')
        .send(userInput({ email: ann.email, firstName: "Changed" }));
      const deleted = await client.delete(`/v1/users/${bob.id}`).set("Authorization", token).set("If-Match", '"1"');
      const restored = await client.post(`/v1/users/${bob.id}/restore`).set("Authorization", token);

      expect([updated.status, deleted.status, restored.status]).toEqual([200, 204, 200]);
    });

    it("E7. 2 users → the 3rd create fits exactly", async () => {
      const client = limitedClient();
      await createUser(client);
      await createUser(client);

      const res = await client.post("/v1/users").set("Authorization", `Bearer ${await adminToken()}`).send(userInput());

      expect(res.status).toBe(201);
    });
  });
});
