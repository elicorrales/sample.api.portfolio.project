import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { expectProblem } from "../helpers/problems.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser, userInput } from "../helpers/users.ts";

// D. Versions (If-Match).

describe("bad calls: versions", () => {
  describe("D1. missing If-Match → 428", () => {
    it("on update", async () => {
      const client = api();
      const user = await createUser(client);
      const res = await client
        .put(`/v1/users/${user.id}`)
        .set("Authorization", `Bearer ${await adminToken()}`)
        .send(userInput({ email: user.email }));
      expectProblem(res, 428);
    });

    it("on delete", async () => {
      const client = api();
      const user = await createUser(client);
      const res = await client.delete(`/v1/users/${user.id}`).set("Authorization", `Bearer ${await adminToken()}`);
      expectProblem(res, 428);
    });
  });

  describe("D2. stale or malformed If-Match → 412, and nothing changes", () => {
    it("update with the version from before someone else's save", async () => {
      const client = api();
      const token = `Bearer ${await adminToken()}`;
      const user = await createUser(client, { lastName: "Adams" });
      const save = (lastName: string) =>
        client
          .put(`/v1/users/${user.id}`)
          .set("Authorization", token)
          .set("If-Match", '"1"')
          .send(userInput({ email: user.email, lastName }));

      expect((await save("First")).status).toBe(200);
      expectProblem(await save("Second"), 412);

      const reloaded = await client.get(`/v1/users/${user.id}?view=detailed`).set("Authorization", token);
      expect(reloaded.body).toMatchObject({ lastName: "First", version: 2 });
    });

    it("delete with a stale version", async () => {
      const client = api();
      const token = `Bearer ${await adminToken()}`;
      const user = await createUser(client);
      await client
        .put(`/v1/users/${user.id}`)
        .set("Authorization", token)
        .set("If-Match", '"1"')
        .send(userInput({ email: user.email }));

      expectProblem(await client.delete(`/v1/users/${user.id}`).set("Authorization", token).set("If-Match", '"1"'), 412);
      expect((await client.get(`/v1/users/${user.id}`).set("Authorization", token)).status).toBe(200);
    });

    it.each(["1", 'W/"1"', "*", '"one"'])("update with a malformed If-Match: %s", async (ifMatch) => {
      const client = api();
      const user = await createUser(client);
      const res = await client
        .put(`/v1/users/${user.id}`)
        .set("Authorization", `Bearer ${await adminToken()}`)
        .set("If-Match", ifMatch)
        .send(userInput({ email: user.email }));
      expectProblem(res, 412);
    });
  });
});
