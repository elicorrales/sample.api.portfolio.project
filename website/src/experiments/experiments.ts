// The Experiments tab (decision 13): each check written as a claim and a prediction, with the tests that prove it.
// Only the flood runs live from this page. The others replay the requests their automated test sends,
// labeled as a replay, since sending them from a public demo would change other visitors' data.
export type Step = { request: string; answer: string; ok: boolean };

export type Experiment = {
  id: string;
  title: string;
  short: string; // one line for the list
  claim: string;
  method: string;
  predict: string;
  careful?: string;
  found?: string; // something learned by trying it by hand
  tests: string[];
  proven: string; // the status code the tests prove
  live: boolean; // true only for the flood
  replay: Step[];
  lastBody?: string; // the API's answer to the last step
};

export const REPO = "https://github.com/elicorrales/sample.api.portfolio.project/blob/main/project/";

const problem = (fields: Record<string, unknown>) => JSON.stringify(fields, null, 2);

export const EXPERIMENTS: Experiment[] = [
  {
    id: "flood",
    title: "Flood the API",
    short: "Runs live from your browser",
    claim: "One visitor gets 100 requests a minute, counted before the token is checked.",
    method: "Send 150 list requests at once, without a token.",
    predict: "100 answered 401; the other 50 refused with 429 and Retry-After.",
    careful: "This blocks your address for up to a minute: the Users tab and Swagger included.",
    tests: ["tests/rate-limit/rate-limit.test.ts"],
    proven: "429",
    live: true,
    replay: [],
  },
  {
    id: "no-token",
    title: "No token at all",
    short: "Every users call needs a token",
    claim: "Without an admin token, the API refuses every users call before looking at anything else.",
    method: "List, open, save, and delete users with no Authorization header, even with a broken body.",
    predict: "401 for each, with the same message whatever else is wrong.",
    tests: ["tests/security/auth-first.test.ts"],
    proven: "401",
    live: false,
    replay: [
      { request: "GET /v1/users", answer: "401", ok: false },
      { request: "GET /v1/users/3f2a8c1e…", answer: "401", ok: false },
      { request: "PUT /v1/users/3f2a8c1e… (body not even JSON)", answer: "401", ok: false },
      { request: "DELETE /v1/users/3f2a8c1e…", answer: "401", ok: false },
    ],
    lastBody: problem({ type: "/problems/unauthorized", title: "Not signed in", status: 401, detail: "A valid admin token is required" }),
  },
  {
    id: "forge-token",
    title: "Forge a token",
    short: "An edited token breaks its signature",
    claim: "Editing a token's contents breaks its signature, so a visitor can't promote themselves.",
    method: "Take a real token, change its role or expiry and keep the old signature; also try one signed with alg: none.",
    predict: "401 for every edited token.",
    tests: ["tests/security/tokens.test.ts"],
    proven: "401",
    live: false,
    replay: [
      { request: "POST /demo/token", answer: "200, token", ok: true },
      { request: "GET /v1/users, token with role changed", answer: "401", ok: false },
      { request: "GET /v1/users, token with expiry pushed to 2099", answer: "401", ok: false },
      { request: "GET /v1/users, token with alg: none", answer: "401", ok: false },
    ],
    lastBody: problem({ type: "/problems/unauthorized", title: "Not signed in", status: 401, detail: "A valid admin token is required" }),
  },
  {
    id: "stale-copy",
    title: "Save a stale copy",
    short: "Two admins can't overwrite each other",
    claim: "Two admins editing the same user can't overwrite each other's changes.",
    method: "Load a user twice. Save the first copy, then the second, each with the version it loaded in If-Match.",
    predict: "200, then 412; the second change is not saved.",
    tests: ["tests/bad-calls/versions.test.ts", "tests/integrity/races.test.ts"],
    proven: "412",
    live: false,
    replay: [
      { request: 'GET /v1/users/3f2a8c1e…?view=detailed', answer: '200, ETag "3"', ok: true },
      { request: 'GET /v1/users/3f2a8c1e…?view=detailed', answer: '200, ETag "3"', ok: true },
      { request: 'PUT /v1/users/3f2a8c1e…, If-Match "3"', answer: '200, ETag "4"', ok: true },
      { request: 'PUT /v1/users/3f2a8c1e…, If-Match "3"', answer: "412", ok: false },
    ],
    lastBody: problem({ type: "/problems/version-mismatch", title: "Version out of date", status: 412, detail: "This record changed since it was loaded; reload and try again" }),
  },
  {
    id: "same-email",
    title: "Same email twice",
    short: "Two users can't share an email",
    claim: "Emails are unique, ignoring case, and deleted users keep theirs.",
    method: "Create a user, then another with the same email in capitals.",
    predict: "201, then 409; only the first is saved.",
    tests: ["tests/bad-calls/conflicts.test.ts", "tests/integrity/races.test.ts"],
    proven: "409",
    live: false,
    replay: [
      { request: "POST /v1/users, ada.lovelace@example.com", answer: "201", ok: true },
      { request: "POST /v1/users, ADA.LOVELACE@example.com", answer: "409", ok: false },
      { request: "GET /v1/users?search=lovelace", answer: "200, 1 user", ok: true },
    ],
    lastBody: problem({ type: "/problems/conflict", title: "Conflict", status: 409, detail: "A user with this email already exists" }),
  },
  {
    id: "nonsense",
    title: "Nonsense input",
    short: "The API names the field it refused",
    claim: "Bad input is refused, and the answer names every field that's wrong.",
    method: "Save a user named R2D2, with phone 105-555-0123, born in 2014, and an extra field role.",
    predict: "400, listing each field with its own message.",
    tests: ["tests/bad-calls/body.test.ts"],
    proven: "400",
    live: false,
    replay: [{ request: "POST /v1/users (4 problems in the body)", answer: "400", ok: false }],
    lastBody: problem({
      type: "/problems/validation",
      title: "Invalid input",
      status: 400,
      detail: "4 field(s) are invalid",
      errors: [
        { field: "firstName", message: "Letters A-Z, spaces, hyphens, periods, and ' only" },
        { field: "dateOfBirth", message: "Must be 18 or older" },
        { field: "phones.0.number", message: "Must be a 10-digit U.S. number; area code can't start with 0 or 1" },
        { field: "role", message: "Unknown field" },
      ],
    }),
  },
  {
    id: "sql-search",
    title: "SQL in the search box",
    short: "Search text is data, never a query",
    claim: "Search text is data, never part of the database query.",
    method: "Search for ' OR '1'='1, and for % and _, SQL's wildcards.",
    predict: "200 with only literal matches; every user still there.",
    found:
      "Tried by hand against the live demo: '; DROP TABLE users;-- never reached the API. Render's firewall answered 403 first, and since that answer had no CORS header, the Users page said \"Can't reach the API\".",
    tests: ["tests/security/injection.test.ts"],
    proven: "200",
    live: false,
    replay: [
      { request: "GET /v1/users?search=' OR '1'='1", answer: "200, 0 users", ok: true },
      { request: "GET /v1/users?search=%", answer: "200, 0 users", ok: true },
      { request: "GET /v1/users?search=_", answer: "200, 0 users", ok: true },
      { request: "GET /v1/users", answer: "200, every user still there", ok: true },
    ],
  },
];
