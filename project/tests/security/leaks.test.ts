import { randomUUID } from "node:crypto";
import { inspect } from "node:util";
import { sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../api/src/app.ts";
import type { UsersRepository } from "../../api/src/users/users.repository.ts";
import { api } from "../helpers/api.ts";
import { testDatabase } from "../helpers/database.ts";
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
      // The server still logs the failure; what that log may contain is D3's job.
      expect(log).toHaveBeenCalledOnce();
    });
  });

  describe("D3. the server's own log of a failure holds no personal data, but still helps", () => {
    // Distinctive values, so finding any of them in the log can't be a coincidence.
    const zelda = userInput({ firstName: "Zelda", lastName: "Quimby", email: "zelda.quimby@example.com", dateOfBirth: "1971-03-14" });
    const personalValues = ["zelda.quimby@example.com", "Zelda", "Quimby", "1971-03-14"];

    // Everything passed to console.error, nested causes included, as one searchable string.
    function captureLog() {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      return { log, text: () => inspect(log.mock.calls, { depth: null }) };
    }

    // A PostgreSQL trigger, added only for these tests, refuses to save anyone named Quimby: a real database
    // failure on the users row itself, so the failed query Drizzle reports carries the name, email, and date of birth.
    beforeAll(async () => {
      await testDatabase.execute(sql`
        CREATE FUNCTION refuse_quimby() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION 'test fault: refused this user';
        END $$`);
      await testDatabase.execute(sql`
        CREATE TRIGGER refuse_quimby BEFORE INSERT ON users
        FOR EACH ROW WHEN (NEW.last_name = 'Quimby') EXECUTE FUNCTION refuse_quimby()`);
    });

    afterAll(async () => {
      await testDatabase.execute(sql`DROP TRIGGER refuse_quimby ON users`);
      await testDatabase.execute(sql`DROP FUNCTION refuse_quimby`);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("D3a. a database failure while creating a user → no name, email, or date of birth in the log", async () => {
      const { log, text } = captureLog();

      const res = await api().post("/v1/users").set("Authorization", `Bearer ${await adminToken()}`).send(zelda);

      expect(res.status).toBe(500);
      expect(log).toHaveBeenCalledOnce();
      for (const value of personalValues) {
        expect(text()).not.toContain(value);
      }
    });

    it("D3b. the same failure → the log still has the method, the path, and PostgreSQL's error code", async () => {
      const { text } = captureLog();

      const res = await api().post("/v1/users").set("Authorization", `Bearer ${await adminToken()}`).send(zelda);

      expect(res.status).toBe(500);
      expect(text()).toContain("POST");
      expect(text()).toContain("/v1/users");
      expect(text()).toContain("P0001"); // PostgreSQL's code for an error raised by the trigger
    });

    it("D3c. a non-database error whose message holds an email → the email isn't logged", async () => {
      const { log, text } = captureLog();
      const throwsWithEmail = async () => {
        throw new Error("lookup failed for zelda.quimby@example.com");
      };
      const client = request(
        createApp({ jwtSecret: TEST_JWT_SECRET, usersRepository: { ...brokenRepository, list: throwsWithEmail } }),
      );

      const res = await client.get("/v1/users").set("Authorization", `Bearer ${await adminToken()}`);

      expect(res.status).toBe(500);
      expect(log).toHaveBeenCalledOnce();
      expect(text()).not.toContain("zelda.quimby@example.com");
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
