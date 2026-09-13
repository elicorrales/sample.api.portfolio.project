import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { expectProblem } from "../helpers/problems.ts";
import { adminToken } from "../helpers/tokens.ts";
import { userInput } from "../helpers/users.ts";

// F. Body size. A huge body is refused before it's read into memory as JSON.

async function createWithRawBody(body: string) {
  return api()
    .post("/v1/users")
    .set("Authorization", `Bearer ${await adminToken()}`)
    .set("Content-Type", "application/json")
    .send(body);
}

describe("security: body size", () => {
  it("F1. a body over 100 KB → 413 with an honest message", async () => {
    const res = await createWithRawBody(JSON.stringify({ ...userInput(), firstName: "a".repeat(110_000) }));
    expectProblem(res, 413);
    expect(res.body.detail).toMatch(/100 KB/);
    expect(res.body.detail).not.toMatch(/JSON/);
  });

  it("F2. a body just under 100 KB is read, then fails the normal rules (400, not 413)", async () => {
    const res = await createWithRawBody(JSON.stringify({ ...userInput(), firstName: "a".repeat(90_000) }));
    expectProblem(res, 400, "firstName");
  });
});
