// A fake API inside the tests (MSW), so they never call Render or use up its rate limit.
// It answers like the real API by default; a test swaps in a different answer with fakeApi.use().
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { API_URL } from "../../src/api/client.ts";
import type { components } from "../../src/api/schema.ts";

type Problem = components["schemas"]["Problem"];
type UserBasic = components["schemas"]["UserBasic"];

export const DEMO_TOKEN = "fake.demo.token";

export const apiUrl = (path: string) => `${API_URL}${path}`;

export const firstPageUsers: UserBasic[] = [
  { id: "0b6f1c2e-1111-4a2b-9c3d-000000000001", firstName: "Carter", lastName: "Lee", email: "carter.lee@example.com" },
  { id: "0b6f1c2e-1111-4a2b-9c3d-000000000002", firstName: "Levi", lastName: "Lewis", email: "levi.lewis@example.com" },
  { id: "0b6f1c2e-1111-4a2b-9c3d-000000000003", firstName: "Mason", lastName: "Lopez", email: "mason.lopez@example.com" },
];

// Problem Details, the way the API sends every error.
export function problem(status: number, title: string, detail: string) {
  const body: Problem = { type: `/problems/${title.toLowerCase().replaceAll(" ", "-")}`, title, status, detail };
  return HttpResponse.json(body, { status, headers: { "Content-Type": "application/problem+json" } });
}

export const fakeApi = setupServer(
  http.post(apiUrl("/demo/token"), () =>
    HttpResponse.json({
      token: DEMO_TOKEN,
      tokenType: "Bearer" as const,
      expiresIn: 3600 as const,
      note: "Demo only: all data is fake and resets every night at 08:00 UTC",
    }),
  ),
  http.get(apiUrl("/v1/users"), () =>
    HttpResponse.json({ items: firstPageUsers, page: 1, pageSize: 10, totalItems: 45, totalPages: 5 }),
  ),
);
