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

// 25 users, already sorted by last name: 3 pages of 10.
const LAST_NAMES = ["Adams", "Allen", "Baker", "Brown", "Clark", "Davis", "Evans", "Flores", "Garcia", "Green", "Hall", "Harris", "Jones", "King", "Lee", "Lewis", "Lopez", "Martin", "Moore", "Nelson", "O'Brien", "Perez", "Reed", "Scott", "Young"];
const FIRST_NAMES = ["Ryan", "Hazel", "Owen", "Noah", "Ivy", "Liam", "Ruby", "Violet", "James", "Isaac", "Mateo", "Wyatt", "Ava", "Leo", "Carter", "Levi", "Mason", "Jackson", "Aiden", "Naomi", "Nora", "Ella", "Mila", "Eli", "Zoe"];
export const twentyFiveUsers: UserBasic[] = LAST_NAMES.map((lastName, i) => ({
  id: `0b6f1c2e-2222-4a2b-9c3d-${String(i + 1).padStart(12, "0")}`,
  firstName: FIRST_NAMES[i],
  lastName,
  email: `${FIRST_NAMES[i].toLowerCase()}.${lastName.toLowerCase().replace("'", "")}@example.com`,
}));

// GET /v1/users the way the API answers it: search (ignoring case), sorted by last name, paged; a page past the end is empty.
export function listAnswer(request: Request, users: UserBasic[]) {
  const query = new URL(request.url).searchParams;
  const search = query.get("search")?.toLowerCase();
  const page = Number(query.get("page") ?? 1);
  const pageSize = Number(query.get("pageSize") ?? 20);
  const matching = users
    .filter((user) => !search || [user.firstName, user.lastName, user.email].some((field) => field.toLowerCase().includes(search)))
    .sort((a, b) => a.lastName.localeCompare(b.lastName));
  return HttpResponse.json({
    items: matching.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalItems: matching.length,
    totalPages: Math.ceil(matching.length / pageSize),
  });
}

export const listLikeTheApi = (users: () => UserBasic[]) => http.get(apiUrl("/v1/users"), ({ request }) => listAnswer(request, users()));

// The list requests seen so far, as query objects, e.g. { sort: "lastName", page: "2", pageSize: "10" }.
export function listQueries(requests: string[]) {
  return requests.filter((request) => request.startsWith("GET /v1/users?") || request === "GET /v1/users").map((request) => Object.fromEntries(new URLSearchParams(request.split("?")[1] ?? "")));
}

// The full user, as GET /v1/users/{id}?view=detailed returns it.
export function detailedUser(user: UserBasic, changes: Partial<UserDetailed> = {}): UserDetailed {
  return {
    ...user,
    dateOfBirth: "1988-04-12",
    // Returned in E.164, as the API stores them.
    phones: [
      { number: "+13055550130", type: "mobile", primary: true },
      { number: "+13055550131", type: "work", primary: false },
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
  const listener = ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    seen.push(`${request.method} ${url.pathname}${url.search}`);
  };
  fakeApi.events.on("request:start", listener);
  onTestFinished(() => fakeApi.events.removeListener("request:start", listener));
  return seen;
}

// Problem Details, the way the API sends every error.
export function problem(status: number, title: string, detail: string, extra: Partial<Problem> = {}) {
  const body: Problem = { type: `/problems/${title.toLowerCase().replaceAll(" ", "-")}`, title, status, detail, ...extra };
  return HttpResponse.json(body, { status, headers: { "Content-Type": "application/problem+json" } });
}

export const fakeApi = setupServer(
  http.post(apiUrl("/demo/token"), () => tokenAnswer()),
  http.get(apiUrl("/v1/users"), () =>
    HttpResponse.json({ items: firstPageUsers, page: 1, pageSize: 10, totalItems: 45, totalPages: 5 }),
  ),
  http.get(apiUrl("/v1/users/:userId"), ({ params }) => {
    const found = [...firstPageUsers, ...twentyFiveUsers].find((user) => user.id === params.userId);
    if (!found) return problem(404, "Not found", "No user with this id");
    const user = detailedUser(found);
    return HttpResponse.json(user, { headers: { ETag: `"${user.version}"` } });
  }),
);
