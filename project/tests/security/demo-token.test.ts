import { decodeJwt } from "jose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, testApp } from "../helpers/api.ts";
import { expectProblem } from "../helpers/problems.ts";

// H. The demo token. On the hosted demo, a visitor gets a 1-hour admin token with one call, so they can try
// the API in Swagger and watch auth work: refused without it, allowed with it, refused again once it expires.
// Anywhere else, nobody gets a free token.

const demoClient = () => request(testApp({ demoMode: true }));

describe("security: demo token", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("H1. demo mode on: POST /demo/token with no token → 200, a 1-hour admin token that is never cached", async () => {
    const res = await demoClient().post("/demo/token");

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toEqual({
      token: expect.any(String),
      tokenType: "Bearer",
      expiresIn: 3600,
      note: "Demo only: all data is fake and resets every night at 08:00 UTC",
    });
    const claims = decodeJwt(res.body.token);
    expect(claims.role).toBe("admin");
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(3600);
  });

  it("H2. the demo token works on the API", async () => {
    const client = demoClient();
    const { body } = await client.post("/demo/token");

    const res = await client.get("/v1/users").set("Authorization", `Bearer ${body.token}`);

    expect(res.status).toBe(200);
  });

  it("H3. the demo token still works just before 1 hour, and stops just after", async () => {
    // Only Date is faked; the token's expiry is checked against it.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T12:00:00Z"));
    const client = demoClient();
    const { body } = await client.post("/demo/token");
    const auth = `Bearer ${body.token}`;

    vi.setSystemTime(new Date("2026-09-13T12:59:59Z"));
    const before = await client.get("/v1/users").set("Authorization", auth);
    vi.setSystemTime(new Date("2026-09-13T13:00:01Z"));
    const after = await client.get("/v1/users").set("Authorization", auth);

    expect(before.status).toBe(200);
    expectProblem(after, 401);
  });

  it("H4. demo mode off (the default): POST /demo/token → 401 like any other path, and no token", async () => {
    const res = await api().post("/demo/token");

    expectProblem(res, 401);
    expect(res.body.token).toBeUndefined();
  });

  it("H5. demo mode on: GET /demo/token → 405, Allow: POST", async () => {
    const res = await demoClient().get("/demo/token");

    expectProblem(res, 405);
    expect(res.headers.allow).toBe("POST");
  });
});
