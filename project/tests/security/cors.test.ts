import request from "supertest";
import { describe, expect, it } from "vitest";
import { testApp } from "../helpers/api.ts";
import { adminToken } from "../helpers/tokens.ts";

// E. CORS. Only the listed web pages may call the API from a browser.

const allowed = "https://admin.example.com";
const client = () => request(testApp({ corsOrigins: [allowed] }));

describe("security: CORS", () => {
  it("E1. an allowed origin gets CORS headers naming exactly that origin", async () => {
    const res = await client().get("/v1/users").set("Origin", allowed).set("Authorization", `Bearer ${await adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(allowed);
    expect(res.headers.vary).toMatch(/Origin/);
  });

  it.each([
    ["another site", "https://evil.example.com"],
    ["a look-alike of the allowed origin", "https://admin.example.com.evil.com"],
    ["the allowed host over http", "http://admin.example.com"],
    ["the null origin (sandboxed pages, local files)", "null"],
  ])("E2. %s gets no CORS headers", async (_name, origin) => {
    const res = await client().get("/v1/users").set("Origin", origin).set("Authorization", `Bearer ${await adminToken()}`);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("E3. a preflight from an allowed origin is answered without a token", async () => {
    const res = await client()
      .options("/v1/users")
      .set("Origin", allowed)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Authorization, Content-Type");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(allowed);
    expect(res.headers["access-control-allow-headers"]).toMatch(/Authorization/);
  });

  it("E4. a preflight from another origin gets no CORS headers", async () => {
    const res = await client()
      .options("/v1/users")
      .set("Origin", "https://evil.example.com")
      .set("Access-Control-Request-Method", "POST");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("E5. a 401 to an allowed origin still has CORS headers, so the web page can read why", async () => {
    const res = await client().get("/v1/users").set("Origin", allowed);
    expect(res.status).toBe(401);
    expect(res.headers["access-control-allow-origin"]).toBe(allowed);
  });

  it("E6. never allows every origin (*)", async () => {
    const res = await client().get("/v1/users").set("Origin", allowed).set("Authorization", `Bearer ${await adminToken()}`);
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });
});
