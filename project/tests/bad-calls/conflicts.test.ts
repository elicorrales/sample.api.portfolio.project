import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
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
});
