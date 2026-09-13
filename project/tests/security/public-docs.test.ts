import { once } from "node:events";
import { readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { api, testApp } from "../helpers/api.ts";

// G. What is public, and what isn't. The docs page and the spec need no token, so anyone can read
// the contract and try it. Everything else still does, and the public folder can't be used to reach other files.

const specOnDisk = readFileSync(new URL("../../api/openapi.yaml", import.meta.url), "utf8");

// Supertest only collects the body as text for text/* and JSON; the spec and scripts need it too.
type Response = { on(event: string, listener: (chunk?: Buffer) => void): void };
function asText(res: Response, done: (err: Error | null, body: string) => void) {
  let body = "";
  res.on("data", (chunk) => (body += chunk?.toString("utf8")));
  res.on("end", () => done(null, body));
}

// Sends the path exactly as written. Supertest (like a browser) resolves `..` and `%2e%2e` before sending,
// so `/docs/../../package.json` would arrive as `/package.json` and never test the docs folder. An attacker's
// own client doesn't have to (`curl --path-as-is`).
async function rawGet(path: string) {
  const server = testApp().listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  try {
    return await new Promise<{ status: number; body: string }>((resolve, reject) => {
      http
        .get({ host: "127.0.0.1", port, path }, (res) => {
          let body = "";
          res.on("data", (chunk: Buffer) => (body += chunk.toString("utf8")));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
        })
        .on("error", reject);
    });
  } finally {
    server.close();
  }
}

describe("security: public docs", () => {
  it("G1. /docs with no token → 200, a page that loads Swagger UI with this API's spec", async () => {
    const res = await api().get("/docs");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/html/);
    expect(res.text).toContain("swagger-ui-bundle.js");
    expect(res.text).toContain("/openapi.yaml"); // not Swagger's sample Petstore spec
  });

  it("G2. Swagger UI's own files with no token → 200", async () => {
    const res = await api().get("/docs/swagger-ui-bundle.js").buffer(true).parse(asText);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/javascript/);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("G3. /openapi.yaml with no token → 200, exactly the spec file in the repo", async () => {
    const res = await api().get("/openapi.yaml").buffer(true).parse(asText);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/yaml/);
    expect(res.body).toBe(specOnDisk);
  });

  it("G4. the spec's server is `/`, so Try it out calls whichever address served the page", () => {
    expect(specOnDisk).toMatch(/^servers:\n {2}- url: \/\n/m);
  });

  it.each([
    "/docs/../../package.json",
    "/docs/%2e%2e/%2e%2e/package.json",
    "/docs/..%2f..%2fpackage.json",
  ])("G5. a path trick out of the docs folder, %s → never another file", async (path) => {
    const res = await rawGet(path);

    expect(res.status).not.toBe(200);
    expect(res.body).not.toContain("users-admin-api");
  });

  it("G6. the API itself still needs a token, now that /docs is public → 401", async () => {
    const res = await api().get("/v1/users");

    expect(res.status).toBe(401);
  });

  it.each(["/docs/index.html", "/docs/package.json"])(
    "G7. other files in the Swagger UI package, %s → not served",
    async (path) => {
      const res = await api().get(path);

      expect(res.status).toBe(401); // not a docs file, so it reaches auth like any other path
    },
  );
});
