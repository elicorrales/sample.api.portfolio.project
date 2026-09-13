import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../api/src/app.ts";
import type { UsersRepository } from "../../api/src/users/users.repository.ts";
import { api } from "../helpers/api.ts";
import { expectProblem } from "../helpers/problems.ts";
import { adminToken, TEST_JWT_SECRET } from "../helpers/tokens.ts";
import { userInput } from "../helpers/users.ts";

// D. Data leaks. Errors and headers tell callers what went wrong, never how the server is built.

// What a real database failure might carry: SQL, a file path, and a stack trace.
const internalError = new Error(
  'relation "users" failed: SELECT * FROM users WHERE email = $1 (at /home/app/api/src/users/users.repository.pg.ts:42)',
);
const fail = async () => {
  throw internalError;
};
const brokenRepository: UsersRepository = { findByEmail: fail, findById: fail, insert: fail, replace: fail, list: fail };

describe("security: data leaks", () => {
  describe("D1. an unexpected failure → 500 with a generic message", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    type Client = ReturnType<typeof request>;
    it.each([
      ["list", (client: Client, token: string) => client.get("/v1/users").set("Authorization", token)],
      ["get", (client: Client, token: string) => client.get(`/v1/users/${randomUUID()}`).set("Authorization", token)],
      ["create", (client: Client, token: string) => client.post("/v1/users").set("Authorization", token).send(userInput())],
    ])("%s", async (_name, call) => {
      // The server still logs the real error (for us); the test keeps that out of its output.
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const client = request(createApp({ jwtSecret: TEST_JWT_SECRET, usersRepository: brokenRepository }));

      const res = await call(client, `Bearer ${await adminToken()}`);

      expectProblem(res, 500);
      expect(res.body.detail).toBe("Something went wrong");
      for (const secret of ["SELECT", "relation", "/home", "users.repository", ".ts", "Error:"]) {
        expect(res.text).not.toContain(secret);
      }
      expect(res.text).not.toMatch(/\n\s+at /);
      expect(log).toHaveBeenCalledWith(internalError);
    });
  });

  describe("D2. no X-Powered-By header (it names the framework)", () => {
    it("on a success", async () => {
      const res = await api().get("/v1/users").set("Authorization", `Bearer ${await adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });

    it("on a 401", async () => {
      const res = await api().get("/v1/users");
      expect(res.status).toBe(401);
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });

    it("on a 404", async () => {
      const res = await api().get("/v1/nope").set("Authorization", `Bearer ${await adminToken()}`);
      expect(res.status).toBe(404);
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });
  });
});
