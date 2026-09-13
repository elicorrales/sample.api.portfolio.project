import { describe, it } from "vitest";
import { api } from "../helpers/api.ts";
import { expectProblem } from "../helpers/problems.ts";
import { adminToken } from "../helpers/tokens.ts";
import { createUser, userInput } from "../helpers/users.ts";

// B. Query strings.

describe("bad calls: query strings", () => {
  it.each([
    ["sort=firstName", "sort"],
    ["order=up", "order"],
    ["page=0", "page"],
    ["page=abc", "page"],
    ["page=1.5", "page"],
    ["pageSize=0", "pageSize"],
    ["pageSize=101", "pageSize"],
    [`search=${"a".repeat(101)}`, "search"],
    ["search=", "search"],
    ["includeDeleted=yes", "includeDeleted"],
  ])("B1. list rejects ?%s", async (query, field) => {
    const res = await api().get(`/v1/users?${query}`).set("Authorization", `Bearer ${await adminToken()}`);
    expectProblem(res, 400, field);
  });

  it.each([
    ["view=full", "view"],
    ["includeDeleted=yes", "includeDeleted"],
  ])("B2. get one rejects ?%s", async (query, field) => {
    const client = api();
    const user = await createUser(client);
    const res = await client.get(`/v1/users/${user.id}?${query}`).set("Authorization", `Bearer ${await adminToken()}`);
    expectProblem(res, 400, field);
  });

  describe("B3. unknown query parameters are rejected, naming them", () => {
    it("on list (a typo of pageSize)", async () => {
      const res = await api().get("/v1/users?pagesize=5").set("Authorization", `Bearer ${await adminToken()}`);
      expectProblem(res, 400, "pagesize");
    });

    it("on get one", async () => {
      const client = api();
      const user = await createUser(client);
      const res = await client.get(`/v1/users/${user.id}?foo=1`).set("Authorization", `Bearer ${await adminToken()}`);
      expectProblem(res, 400, "foo");
    });

    type Client = ReturnType<typeof api>;
    const noQueryOperations: [string, (client: Client, id: string, token: string) => ReturnType<Client["get"]>][] = [
      ["create", (client, _id, token) => client.post("/v1/users?foo=1").set("Authorization", token).send(userInput())],
      [
        "update",
        (client, id, token) =>
          client.put(`/v1/users/${id}?foo=1`).set("Authorization", token).set("If-Match", '"1"').send(userInput()),
      ],
      ["delete", (client, id, token) => client.delete(`/v1/users/${id}?foo=1`).set("Authorization", token).set("If-Match", '"1"')],
      ["restore", (client, id, token) => client.post(`/v1/users/${id}/restore?foo=1`).set("Authorization", token)],
    ];

    it.each(noQueryOperations)("on %s, which takes no query parameters", async (_name, call) => {
      const client = api();
      const user = await createUser(client);
      expectProblem(await call(client, user.id, `Bearer ${await adminToken()}`), 400, "foo");
    });
  });
});
