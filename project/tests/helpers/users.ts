import type { api } from "./api.ts";
import { adminToken } from "./tokens.ts";

let emailCounter = 0;

// A valid user body. Each call gets a unique email; tests override only the fields they care about.
export function userInput(overrides: Record<string, unknown> = {}) {
  emailCounter += 1;
  return {
    firstName: "Test",
    lastName: "User",
    email: `user${emailCounter}@example.com`,
    dateOfBirth: "1990-01-01",
    phones: [{ number: "3055551234", type: "mobile" }],
    addresses: [{ street: "1 Main St", city: "Miami", state: "FL", zip: "33101", type: "home" }],
    ...overrides,
  };
}

// Creates a user through the API (as a real admin would) and returns the response body.
// Fails loudly if the create itself fails, so a broken setup isn't mistaken for a broken list.
export async function createUser(client: ReturnType<typeof api>, overrides: Record<string, unknown> = {}) {
  const res = await client
    .post("/v1/users")
    .set("Authorization", `Bearer ${await adminToken()}`)
    .send(userInput(overrides));
  if (res.status !== 201) {
    throw new Error(`createUser setup failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}
