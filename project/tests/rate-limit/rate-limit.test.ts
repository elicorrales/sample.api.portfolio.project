import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AppOptions, createApp } from "../../api/src/app.ts";
import { expectProblem } from "../helpers/problems.ts";
import { adminToken, TEST_JWT_SECRET } from "../helpers/tokens.ts";
import { userInput } from "../helpers/users.ts";

// Rate limiting. A fixed window per client IP: 3 requests per 60-second window in these tests,
// checked before auth. The clock is frozen, so windows open and close exactly when a test says.

const windowStart = new Date("2026-01-01T12:00:00Z");
const at = (seconds: number) => vi.setSystemTime(new Date(windowStart.getTime() + seconds * 1000));

function limitedApp(options: Partial<AppOptions> = {}) {
  return request(createApp({ jwtSecret: TEST_JWT_SECRET, rateLimit: { limit: 3, windowSeconds: 60 }, ...options }));
}

type Client = ReturnType<typeof limitedApp>;

async function useUpLimit(client: Client, set: Record<string, string> = {}) {
  for (let i = 0; i < 3; i++) {
    const res = await client.get("/v1/users").set("Authorization", `Bearer ${await adminToken()}`).set(set);
    expect(res.status).toBe(200);
  }
}

function expectRateLimited(res: request.Response, retryAfterSeconds: number) {
  expectProblem(res, 429);
  expect(res.headers["retry-after"]).toBe(String(retryAfterSeconds));
}

describe("rate limiting", () => {
  beforeEach(() => {
    // Only Date is faked: supertest still needs real timers.
    vi.useFakeTimers({ toFake: ["Date"] });
    at(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("R1. requests up to the limit get normal responses", async () => {
    await useUpLimit(limitedApp());
  });

  it("R2. one request over the limit → 429 with Retry-After in whole seconds", async () => {
    const client = limitedApp();
    await useUpLimit(client);
    expectRateLimited(await client.get("/v1/users").set("Authorization", `Bearer ${await adminToken()}`), 60);
  });

  it("R3. when the window ends, requests are allowed again", async () => {
    const client = limitedApp();
    await useUpLimit(client);
    at(59);
    expectRateLimited(await client.get("/v1/users").set("Authorization", `Bearer ${await adminToken()}`), 1);
    at(60);
    await useUpLimit(client);
  });

  it("R4. Retry-After counts down to the end of the window", async () => {
    const client = limitedApp();
    await useUpLimit(client);
    at(30);
    expectRateLimited(await client.get("/v1/users").set("Authorization", `Bearer ${await adminToken()}`), 30);
  });

  describe("R5. requests without a valid token count too (stops token-guessing floods)", () => {
    it("after 3 guesses, a 4th gets 429, not 401", async () => {
      const client = limitedApp();
      for (let i = 0; i < 3; i++) {
        expectProblem(await client.get("/v1/users").set("Authorization", `Bearer guess-${i}`), 401);
      }
      expectRateLimited(await client.get("/v1/users").set("Authorization", "Bearer guess-3"), 60);
    });

    it("after 3 guesses, even a valid admin token from the same client gets 429", async () => {
      const client = limitedApp();
      for (let i = 0; i < 3; i++) {
        expectProblem(await client.get("/v1/users"), 401);
      }
      expectRateLimited(await client.get("/v1/users").set("Authorization", `Bearer ${await adminToken()}`), 60);
    });
  });

  it("R6. a blocked create saves nothing", async () => {
    const client = limitedApp();
    await useUpLimit(client);
    expectRateLimited(await client.post("/v1/users").set("Authorization", `Bearer ${await adminToken()}`).send(userInput()), 60);

    at(60);
    const res = await client.get("/v1/users").set("Authorization", `Bearer ${await adminToken()}`);
    expect(res.body.totalItems).toBe(0);
  });

  it("R7. two clients have separate limits (behind a trusted proxy that reports each client's IP)", async () => {
    const client = limitedApp({ trustProxy: 1 });
    const clientA = { "X-Forwarded-For": "203.0.113.1" };
    const clientB = { "X-Forwarded-For": "203.0.113.2" };

    await useUpLimit(client, clientA);
    expectRateLimited(
      await client.get("/v1/users").set("Authorization", `Bearer ${await adminToken()}`).set(clientA),
      60,
    );
    await useUpLimit(client, clientB);
  });

  describe("R8. a faked X-Forwarded-For doesn't get a fresh limit", () => {
    it("with no proxy trusted (the default), the header is ignored", async () => {
      const client = limitedApp();
      await useUpLimit(client);
      const res = await client
        .get("/v1/users")
        .set("Authorization", `Bearer ${await adminToken()}`)
        .set("X-Forwarded-For", "198.51.100.77");
      expectRateLimited(res, 60);
    });

    it("behind a trusted proxy, a fake address added by the client is ignored", async () => {
      // The client sends "X-Forwarded-For: <fake>"; the proxy appends the real address. Only the last one counts.
      const client = limitedApp({ trustProxy: 1 });
      const real = { "X-Forwarded-For": "203.0.113.9" };
      await useUpLimit(client, real);
      const res = await client
        .get("/v1/users")
        .set("Authorization", `Bearer ${await adminToken()}`)
        .set("X-Forwarded-For", "198.51.100.77, 203.0.113.9");
      expectRateLimited(res, 60);
    });
  });

  it("R9. a 429 to the allowed web page has CORS headers, so the page can read Retry-After", async () => {
    const origin = "https://admin.example.com";
    const client = limitedApp({ corsOrigins: [origin] });
    await useUpLimit(client, { Origin: origin });

    const res = await client.get("/v1/users").set("Authorization", `Bearer ${await adminToken()}`).set("Origin", origin);
    expectRateLimited(res, 60);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
    expect(res.headers["access-control-expose-headers"]).toMatch(/Retry-After/);
  });

  it("R10. browser preflights (OPTIONS) don't use up the limit", async () => {
    const origin = "https://admin.example.com";
    const client = limitedApp({ corsOrigins: [origin] });
    for (let i = 0; i < 5; i++) {
      const res = await client.options("/v1/users").set("Origin", origin).set("Access-Control-Request-Method", "POST");
      expect(res.status).toBe(204);
    }
    await useUpLimit(client);
    expectRateLimited(await client.get("/v1/users").set("Authorization", `Bearer ${await adminToken()}`), 60);
  });
});
