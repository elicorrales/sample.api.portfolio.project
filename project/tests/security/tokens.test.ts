import { SignJWT } from "jose";
import type { Response } from "supertest";
import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { expectProblem } from "../helpers/problems.ts";
import { adminToken, expiredAdminToken, nonAdminToken, TEST_JWT_SECRET } from "../helpers/tokens.ts";

// A. Tokens. Every way a caller can try to get in without a valid admin token.

const key = new TextEncoder().encode(TEST_JWT_SECRET);
const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const inFiveMinutes = () => Math.floor(Date.now() / 1000) + 300;

// Every 401 looks the same, whatever the reason, so a caller learns nothing about why.
function expectUnauthorized(res: Response) {
  expectProblem(res, 401);
  expect(res.headers["www-authenticate"]).toBe("Bearer");
  expect(res.body.detail).toBe("A valid admin token is required");
}

const list = (authorization?: string) => {
  const req = api().get("/v1/users");
  return authorization === undefined ? req : req.set("Authorization", authorization);
};

describe("security: tokens", () => {
  describe("A1. no usable token → 401", () => {
    it("no Authorization header", async () => {
      expectUnauthorized(await list());
    });

    it.each([
      ["Basic credentials", () => "Basic dXNlcjpwYXNz"],
      ["another scheme with a valid token", async () => `Token ${await adminToken()}`],
      ["a valid token with no scheme", async () => adminToken()],
      ["Bearer with no token", () => "Bearer"],
      ["Bearer with random text", () => "Bearer abc"],
      ["Bearer with a malformed JWT", () => "Bearer not.a.jwt"],
    ])("%s", async (_name, header) => {
      expectUnauthorized(await list(await header()));
    });
  });

  describe("A2. tokens that look real but aren't trusted → 401", () => {
    it("signed with a different secret", async () => {
      const token = await new SignJWT({ role: "admin" })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("5m")
        .sign(new TextEncoder().encode("a-guessed-secret"));
      expectUnauthorized(await list(`Bearer ${token}`));
    });

    it("unsigned (alg: none)", async () => {
      const token = `${base64url({ alg: "none", typ: "JWT" })}.${base64url({ role: "admin", exp: inFiveMinutes() })}.`;
      expectUnauthorized(await list(`Bearer ${token}`));
    });

    it("signed with the right secret but a different algorithm (HS512)", async () => {
      const token = await new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "HS512" }).setExpirationTime("5m").sign(key);
      expectUnauthorized(await list(`Bearer ${token}`));
    });

    it("a non-admin token edited to say admin (signature no longer matches)", async () => {
      const [header, , signature] = (await nonAdminToken()).split(".");
      const edited = `${header}.${base64url({ role: "admin", sub: "test-caller", exp: inFiveMinutes() })}.${signature}`;
      expectUnauthorized(await list(`Bearer ${edited}`));
    });

    it("expired", async () => {
      expectUnauthorized(await list(`Bearer ${await expiredAdminToken()}`));
    });

    it("not valid yet (nbf in the future)", async () => {
      const token = await new SignJWT({ role: "admin" })
        .setProtectedHeader({ alg: "HS256" })
        .setNotBefore("1h")
        .setExpirationTime("2h")
        .sign(key);
      expectUnauthorized(await list(`Bearer ${token}`));
    });

    it("no expiry at all (would work forever if leaked)", async () => {
      const token = await new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().sign(key);
      expectUnauthorized(await list(`Bearer ${token}`));
    });
  });

  describe("A3. valid token, but not an admin → 403", () => {
    const signWithRole = (claims: Record<string, unknown>) =>
      new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setExpirationTime("5m").sign(key);

    it.each([
      ["role user", { role: "user" }],
      ["no role", {}],
      ["role Admin (wrong case)", { role: "Admin" }],
      ["role as a list", { role: ["admin"] }],
    ])("%s", async (_name, claims) => {
      expectProblem(await list(`Bearer ${await signWithRole(claims)}`), 403);
    });

    it("the helper's non-admin token", async () => {
      expectProblem(await list(`Bearer ${await nonAdminToken()}`), 403);
    });
  });

  describe("A4. the scheme name ignores case (RFC 9110); the token doesn't", () => {
    it.each(["bearer", "BEARER", "BeArEr"])("%s + a valid token → 200", async (scheme) => {
      const res = await list(`${scheme} ${await adminToken()}`);
      expect(res.status).toBe(200);
    });

    it("Bearer + a valid token in lowercase → 401", async () => {
      expectUnauthorized(await list(`Bearer ${(await adminToken()).toLowerCase()}`));
    });
  });
});
