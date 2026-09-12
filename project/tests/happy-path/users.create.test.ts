import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { adminToken } from "../helpers/tokens.ts";

const validUser = {
  firstName: "José",
  lastName: "García-López",
  email: "jose.garcia@example.com",
  dateOfBirth: "1990-05-17",
};

describe("POST /v1/users", () => {
  it("creates a user and returns it in the detailed view", async () => {
    const res = await api()
      .post("/v1/users")
      .set("Authorization", `Bearer ${await adminToken()}`)
      .send(validUser);

    expect(res.status).toBe(201);
    expect(res.headers.location).toMatch(/^\/v1\/users\/[0-9a-f-]{36}$/);
    expect(res.headers.etag).toBe('"1"');
    expect(res.body).toMatchObject({
      ...validUser,
      phones: [],
      addresses: [],
      version: 1,
    });
  });
});
