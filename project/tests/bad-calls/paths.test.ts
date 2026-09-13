import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { expectProblem } from "../helpers/problems.ts";
import { adminToken } from "../helpers/tokens.ts";

// F. Paths, methods, and headers.

const id = randomUUID();

describe("bad calls: paths and headers", () => {
  it.each(["/", "/v1/nope", `/v1/users/${id}/nope`, "/v2/users"])("F1. unknown path %s → 404", async (path) => {
    expectProblem(await api().get(path).set("Authorization", `Bearer ${await adminToken()}`), 404);
  });

  it.each([
    ["patch", "/v1/users", "GET, POST"],
    ["delete", "/v1/users", "GET, POST"],
    ["patch", `/v1/users/${id}`, "GET, PUT, DELETE"],
    ["post", `/v1/users/${id}`, "GET, PUT, DELETE"],
    ["get", `/v1/users/${id}/restore`, "POST"],
  ] as const)("F2. %s %s → 405, allowing %s", async (method, path, allow) => {
    const res = await api()[method](path).set("Authorization", `Bearer ${await adminToken()}`);
    expectProblem(res, 405);
    expect(res.headers.allow).toBe(allow);
  });

  describe("F3. only responses that return a user carry an ETag", () => {
    it("not on a list", async () => {
      const res = await api().get("/v1/users").set("Authorization", `Bearer ${await adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.headers.etag).toBeUndefined();
    });

    it.each([
      ["404", `/v1/users/${id}`],
      ["400", "/v1/users/abc"],
    ])("not on a %s error", async (_status, path) => {
      const res = await api().get(path).set("Authorization", `Bearer ${await adminToken()}`);
      expect(res.headers.etag).toBeUndefined();
    });
  });
});
