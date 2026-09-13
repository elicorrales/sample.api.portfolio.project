import { randomUUID } from "node:crypto";
import { describe, it } from "vitest";
import { api } from "../helpers/api.ts";
import { expectProblem } from "../helpers/problems.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser, userInput } from "../helpers/users.ts";

// C. Ids and existence. Every operation that takes a user id is checked.

type Client = ReturnType<typeof api>;

const operations: [string, (client: Client, id: string, token: string) => ReturnType<Client["get"]>][] = [
  ["get", (client, id, token) => client.get(`/v1/users/${id}`).set("Authorization", token)],
  [
    "update",
    (client, id, token) =>
      client.put(`/v1/users/${id}`).set("Authorization", token).set("If-Match", '"1"').send(userInput()),
  ],
  ["delete", (client, id, token) => client.delete(`/v1/users/${id}`).set("Authorization", token).set("If-Match", '"1"')],
  ["restore", (client, id, token) => client.post(`/v1/users/${id}/restore`).set("Authorization", token)],
];

describe("bad calls: ids", () => {
  it.each(operations)("C1. %s rejects an id that isn't a UUID", async (_name, call) => {
    expectProblem(await call(api(), "abc", `Bearer ${await adminToken()}`), 400, "userId");
  });

  it.each(operations)("C2. %s returns 404 for an id that doesn't exist", async (_name, call) => {
    expectProblem(await call(api(), randomUUID(), `Bearer ${await adminToken()}`), 404);
  });

  it("C3. deleting an already-deleted user returns 404", async () => {
    const client = api();
    const token = `Bearer ${await adminToken()}`;
    const user = await createUser(client);
    await client.delete(`/v1/users/${user.id}`).set("Authorization", token).set("If-Match", '"1"');

    const res = await client.delete(`/v1/users/${user.id}`).set("Authorization", token).set("If-Match", '"2"');

    expectProblem(res, 404);
  });
});
