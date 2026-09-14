// A fake API that remembers changes: create, replace, delete, and restore, with versions (If-Match → 412),
// email conflicts (409), and deleted users hidden unless includeDeleted=true. Validation (400) isn't faked here;
// a test that needs a 400 swaps in that answer with fakeApi.use(), since the real rules live in the API.
import { http, HttpResponse } from "msw";
import type { components } from "../../src/api/schema.ts";
import { apiUrl, detailedUser, listAnswer, problem } from "./fake-api.ts";

type UserDetailed = components["schemas"]["UserDetailed"];
type UserInput = components["schemas"]["UserInput"];

export function fakeUserStore(start: UserDetailed[]) {
  // An active user's deletedAt is null, as the API returns it with includeDeleted=true.
  const users = new Map<string, UserDetailed>(start.map((user) => [user.id, structuredClone({ deletedAt: null, ...user })]));
  let created = 0;
  let clock = Date.parse("2026-09-13T12:00:00Z");
  const now = () => new Date((clock += 60_000)).toISOString().replace(".000", "");

  const answer = (user: UserDetailed, status = 200) =>
    HttpResponse.json(user, { status, headers: { ETag: `"${user.version}"` } });

  const emailTaken = (email: string, exceptId?: string) =>
    [...users.values()].some((user) => user.id !== exceptId && user.email.toLowerCase() === email.toLowerCase());

  const fromInput = (input: UserInput, id: string, version: number, createdAt: string): UserDetailed => ({
    id,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    dateOfBirth: input.dateOfBirth,
    // The API stores phone numbers as E.164.
    phones: input.phones.map((phone) => ({ number: `+1${phone.number.replace(/\D/g, "").slice(-10)}`, type: phone.type, primary: input.phones.length === 1 || phone.primary === true })),
    addresses: input.addresses.map((address) => ({ ...address, street2: address.street2 ?? null, primary: input.addresses.length === 1 || address.primary === true })),
    version,
    createdAt,
    updatedAt: now(),
    deletedAt: null,
  });

  const handlers = [
    http.get(apiUrl("/v1/users"), ({ request }) => {
      const includeDeleted = new URL(request.url).searchParams.get("includeDeleted") === "true";
      const basics = [...users.values()]
        .filter((user) => includeDeleted || !user.deletedAt)
        .map(({ id, firstName, lastName, email, deletedAt }) => ({ id, firstName, lastName, email, ...(includeDeleted ? { deletedAt } : {}) }));
      return listAnswer(request, basics);
    }),

    http.get(apiUrl("/v1/users/:userId"), ({ request, params }) => {
      const user = users.get(String(params.userId));
      const includeDeleted = new URL(request.url).searchParams.get("includeDeleted") === "true";
      if (!user || (user.deletedAt && !includeDeleted)) return problem(404, "Not found", "No user with this id");
      return answer(user);
    }),

    http.post(apiUrl("/v1/users"), async ({ request }) => {
      const input = (await request.json()) as UserInput;
      if (emailTaken(input.email)) return problem(409, "Conflict", "Another user already has this email");
      const id = `0b6f1c2e-3333-4a2b-9c3d-${String(++created).padStart(12, "0")}`;
      const user = fromInput(input, id, 1, now());
      users.set(id, user);
      return answer(user, 201);
    }),

    http.put(apiUrl("/v1/users/:userId"), async ({ request, params }) => {
      const user = users.get(String(params.userId));
      if (!user || user.deletedAt) return problem(404, "Not found", "No user with this id");
      const ifMatch = request.headers.get("If-Match");
      if (!ifMatch) return problem(428, "Version required", "Send the ETag you loaded in If-Match");
      if (ifMatch !== `"${user.version}"`) return problem(412, "Version out of date", "This record changed since it was loaded; reload and try again");
      const input = (await request.json()) as UserInput;
      if (emailTaken(input.email, user.id)) return problem(409, "Conflict", "Another user already has this email");
      const updated = fromInput(input, user.id, user.version + 1, user.createdAt);
      users.set(user.id, updated);
      return answer(updated);
    }),

    http.delete(apiUrl("/v1/users/:userId"), ({ request, params }) => {
      const user = users.get(String(params.userId));
      if (!user || user.deletedAt) return problem(404, "Not found", "No user with this id");
      const ifMatch = request.headers.get("If-Match");
      if (!ifMatch) return problem(428, "Version required", "Send the ETag you loaded in If-Match");
      if (ifMatch !== `"${user.version}"`) return problem(412, "Version out of date", "This record changed since it was loaded; reload and try again");
      users.set(user.id, { ...user, version: user.version + 1, deletedAt: now(), updatedAt: now() });
      return new HttpResponse(null, { status: 204 });
    }),

    http.post(apiUrl("/v1/users/:userId/restore"), ({ params }) => {
      const user = users.get(String(params.userId));
      if (!user) return problem(404, "Not found", "No user with this id");
      if (!user.deletedAt) return problem(409, "Conflict", "This user isn't deleted");
      const restored = { ...user, version: user.version + 1, deletedAt: null, updatedAt: now() };
      users.set(user.id, restored);
      return answer(restored);
    }),
  ];

  // For tests: another admin's change, made directly in the store.
  const changeBehindTheScenes = (id: string, change: Partial<UserDetailed>) => {
    const user = users.get(id)!;
    users.set(id, { ...user, ...change, version: user.version + 1, updatedAt: now() });
  };

  return { handlers, users, changeBehindTheScenes };
}

// Three stored users as the API returns them (phones in E.164); Nora is already deleted.
export function threeUsers(): UserDetailed[] {
  const base = (id: string, firstName: string, lastName: string, changes: Partial<UserDetailed> = {}) =>
    detailedUser({ id, firstName, lastName, email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace("'", "")}@example.com` }, changes);
  return [
    base("0b6f1c2e-4444-4a2b-9c3d-000000000001", "Carter", "Lee"),
    base("0b6f1c2e-4444-4a2b-9c3d-000000000002", "Levi", "Lewis"),
    base("0b6f1c2e-4444-4a2b-9c3d-000000000003", "Nora", "O'Brien", { deletedAt: "2026-09-13T09:00:00Z", version: 4 }),
  ];
}
