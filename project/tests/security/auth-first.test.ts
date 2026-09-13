import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { expectProblem } from "../helpers/problems.ts";
import { adminToken, nonAdminToken } from "../helpers/tokens.ts";
import { userInput } from "../helpers/users.ts";

// B. Auth before anything else. Without a valid admin token, every request gets the same
// 401 (or 403), so a caller can't learn what exists or which rules apply.

const oversizedBody = JSON.stringify({ ...userInput(), firstName: "a".repeat(110_000) });

describe("security: auth runs before anything else", () => {
  describe("B1. no token → 401, not the error a signed-in caller would get", () => {
    it.each([
      ["an unknown user id (not 404)", () => api().get(`/v1/users/${randomUUID()}`)],
      ["an id that isn't a UUID (not 400)", () => api().get("/v1/users/abc")],
      ["an unknown query parameter (not 400)", () => api().get("/v1/users?pagesize=5")],
      ["an invalid body (not 400)", () => api().post("/v1/users").send({})],
      [
        "malformed JSON (not 400)",
        () => api().post("/v1/users").set("Content-Type", "application/json").send('{"firstName": '),
      ],
      [
        "an oversized body (not 413)",
        () => api().post("/v1/users").set("Content-Type", "application/json").send(oversizedBody),
      ],
      ["an update without If-Match (not 428)", () => api().put(`/v1/users/${randomUUID()}`).send(userInput())],
      ["an unknown path (not 404)", () => api().get("/v1/nope")],
    ])("%s", async (_name, call) => {
      expectProblem(await call(), 401);
    });

    it("a wrong method (not 405, and no Allow header)", async () => {
      const res = await api().patch("/v1/users");
      expectProblem(res, 401);
      expect(res.headers.allow).toBeUndefined();
    });
  });

  describe("B2. non-admin token → 403, not the error an admin would get", () => {
    it("an unknown user id (not 404)", async () => {
      expectProblem(await api().get(`/v1/users/${randomUUID()}`).set("Authorization", `Bearer ${await nonAdminToken()}`), 403);
    });

    it("malformed JSON (not 400)", async () => {
      const res = await api()
        .post("/v1/users")
        .set("Authorization", `Bearer ${await nonAdminToken()}`)
        .set("Content-Type", "application/json")
        .send('{"firstName": ');
      expectProblem(res, 403);
    });
  });

  it("B3. a rejected create saves nothing", async () => {
    const client = api();
    expectProblem(await client.post("/v1/users").send(userInput()), 401);
    expectProblem(await client.post("/v1/users").set("Authorization", `Bearer ${await nonAdminToken()}`).send(userInput()), 403);

    const res = await client.get("/v1/users").set("Authorization", `Bearer ${await adminToken()}`);
    expect(res.body.totalItems).toBe(0);
  });
});
