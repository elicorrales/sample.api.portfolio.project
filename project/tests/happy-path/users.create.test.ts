import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { adminToken } from "../helpers/tokens.ts";

// The smallest valid user: one phone and one address, neither marked primary.
const validUser = {
  firstName: "José",
  lastName: "García-López",
  email: "jose.garcia@example.com",
  dateOfBirth: "1990-05-17",
  phones: [{ number: "(305) 555-1234", type: "mobile" }],
  addresses: [
    {
      street: "123 Main St",
      street2: "Apt 4B",
      city: "Miami",
      state: "FL",
      zip: "33101",
      type: "home",
    },
  ],
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
      firstName: validUser.firstName,
      lastName: validUser.lastName,
      email: validUser.email,
      dateOfBirth: validUser.dateOfBirth,
      // Returned as E.164, and primary automatically since it's the only one.
      phones: [{ number: "+13055551234", type: "mobile", primary: true }],
      addresses: [{ ...validUser.addresses[0], primary: true }],
      version: 1,
    });
  });
});
