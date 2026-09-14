// A fake API inside the tests (MSW), so they never call Render or use up its rate limit.
// It answers like the real API by default; a test swaps in a different answer with fakeApi.use().
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { onTestFinished } from "vitest";
import { API_URL } from "../../src/api/client.ts";
import type { components } from "../../src/api/schema.ts";

type Problem = components["schemas"]["Problem"];
type UserBasic = components["schemas"]["UserBasic"];
type UserDetailed = components["schemas"]["UserDetailed"];

export const DEMO_TOKEN = "fake.demo.token";

export const apiUrl = (path: string) => `${API_URL}${path}`;

export const firstPageUsers: UserBasic[] = [
  { id: "0b6f1c2e-1111-4a2b-9c3d-000000000001", firstName: "Carter", lastName: "Lee", email: "carter.lee@example.com" },
  { id: "0b6f1c2e-1111-4a2b-9c3d-000000000002", firstName: "Levi", lastName: "Lewis", email: "levi.lewis@example.com" },
  { id: "0b6f1c2e-1111-4a2b-9c3d-000000000003", firstName: "Mason", lastName: "Lopez", email: "mason.lopez@example.com" },
];

// The full user, as GET /v1/users/{id}?view=detailed returns it.
export function detailedUser(user: UserBasic, changes: Partial<UserDetailed> = {}): UserDetailed {
  return {
    ...user,
    dateOfBirth: "1988-04-12",
    phones: [
      { number: "(305) 555-0130", type: "mobile", primary: true },
      { number: "(305) 555-0131", type: "work", primary: false },
    ],
    addresses: [{ street: "1420 Brickell Ave", street2: "Apt 4B", city: "Miami", state: "FL", zip: "33101", type: "home", primary: true }],
    version: 3,
    createdAt: "2026-09-12T18:40:00Z",
    updatedAt: "2026-09-13T10:42:00Z",
    ...changes,
  };
}

// The answer to POST /demo/token.
export function tokenAnswer() {
  return HttpResponse.json({
    token: DEMO_TOKEN,
    tokenType: "Bearer" as const,
    expiresIn: 3600 as const,
    note: "Demo only: all data is fake and resets every night at 08:00 UTC",
  });
}

// Counts every request that reaches the fake API from now until the test ends.
export function countRequests() {
  const seen: string[] = [];
  const listener = ({ request }: { request: Request }) => void seen.push(`${request.method} ${new URL(request.url).pathname}`);
  fakeApi.events.on("request:start", listener);
  onTestFinished(() => fakeApi.events.removeListener("request:start", listener));
  return seen;
}

// Problem Details, the way the API sends every error.
export function problem(status: number, title: string, detail: string) {
  const body: Problem = { type: `/problems/${title.toLowerCase().replaceAll(" ", "-")}`, title, status, detail };
  return HttpResponse.json(body, { status, headers: { "Content-Type": "application/problem+json" } });
}

export const fakeApi = setupServer(
  http.post(apiUrl("/demo/token"), () => tokenAnswer()),
  http.get(apiUrl("/v1/users"), () =>
    HttpResponse.json({ items: firstPageUsers, page: 1, pageSize: 10, totalItems: 45, totalPages: 5 }),
  ),
  http.get(apiUrl("/v1/users/:userId"), ({ params }) => {
    const found = firstPageUsers.find((user) => user.id === params.userId);
    if (!found) return problem(404, "Not found", "No user with this id");
    const user = detailedUser(found);
    return HttpResponse.json(user, { headers: { ETag: `"${user.version}"` } });
  }),
);
