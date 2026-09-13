import { describe, expect, it } from "vitest";
import { api } from "../helpers/api.ts";
import { adminToken } from "../helpers/tokens.ts";

// The smallest valid user: one phone and one address, neither marked primary.
const validUser = {
  firstName: "Jose",
  lastName: "Garcia-Lopez",
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

  it("creates a user with 3 phones and 3 addresses, sorted primary first, then by type", async () => {
    // Sent out of order, with the primary on neither the first sent nor the first by type.
    const fullUser = {
      ...validUser,
      email: "ana.nguyen@example.com",
      phones: [
        { number: "305.555.0003", type: "work", primary: false },
        { number: "3055550001", type: "mobile", primary: false },
        { number: "+1 305 555 0002", type: "home", primary: true },
      ],
      addresses: [
        { street: "9 Mail Rd", city: "Miami", state: "FL", zip: "33103", type: "mailing", primary: false },
        { street: "5 Office Ave", city: "Boston", state: "MA", zip: "02134", type: "work", primary: true },
        { street: "1 Home Ln", city: "Miami", state: "FL", zip: "33101", type: "home", primary: false },
      ],
    };

    const res = await api()
      .post("/v1/users")
      .set("Authorization", `Bearer ${await adminToken()}`)
      .send(fullUser);

    expect(res.status).toBe(201);
    // Phone type order: mobile, home, work. Address type order: home, work, mailing.
    expect(res.body.phones).toEqual([
      { number: "+13055550002", type: "home", primary: true },
      { number: "+13055550001", type: "mobile", primary: false },
      { number: "+13055550003", type: "work", primary: false },
    ]);
    // No street2 sent → null. ZIP leading zero kept.
    expect(res.body.addresses).toEqual([
      { street: "5 Office Ave", street2: null, city: "Boston", state: "MA", zip: "02134", type: "work", primary: true },
      { street: "1 Home Ln", street2: null, city: "Miami", state: "FL", zip: "33101", type: "home", primary: false },
      { street: "9 Mail Rd", street2: null, city: "Miami", state: "FL", zip: "33103", type: "mailing", primary: false },
    ]);
  });
});
