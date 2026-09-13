# Tests

**What the API refuses matters more than what it accepts.** Anyone can show that valid input works. Most of this test suite proves the opposite: bad input, stale versions, conflicts, wrong paths, forged tokens, and attacks all fail the right way, with a clear error and no damage.

**Last updated:** 2026-09-13 · **192 tests, all green**

## By category

Most important first. The categories come from [decision 03](decisions/03-test-strategy.md#test-categories).

| Category | What it proves | Tests | Status | Folder | Run it (from `project/`) |
|---|---|---|---|---|---|
| **Bad calls** | Every kind of client mistake is rejected with the right status and a useful error | **115** | ✅ Green | [`tests/bad-calls/`](../tests/bad-calls/) | `npm run test:bad-calls` |
| **Security** | Forged, expired, or missing tokens get nothing; auth runs before anything else; injection, data leaks, and other origins are blocked | **60** | ✅ Green | [`tests/security/`](../tests/security/) | `npm run test:security` |
| **Integrity** | Two admins at once can't corrupt data or silently overwrite each other | — | ⏳ Planned (needs a real database) | | |
| **Rate limiting** | Too many requests get `429`, not a slow or crashed server | — | ⏳ Planned | | |
| **Performance** | Search and paging stay fast with many users | — | ⏳ Planned (separate load-test tool) | | |
| Happy path + workflow | Each operation works, and they work together in one admin session | 17 | ✅ Green | [`tests/happy-path/`](../tests/happy-path/), [`tests/workflow/`](../tests/workflow/) | `npm run test:happy-path` |

## Bad calls: 115 tests

Every error uses the same format ([Problem Details](decisions/10-api-conventions.md#pushback-problem-details-is-json)) and names the field at fault, so a web form can show the message next to the right input.

### A. Request body: 64 tests ([`body.test.ts`](../tests/bad-calls/body.test.ts))

| Group | Example cases | Result |
|---|---|---|
| Not JSON, or no body | `{"firstName": ` (cut off); plain text; nothing | `400` |
| Missing fields | Each of the 6 required fields left out | `400`, naming the field |
| Unknown fields | `id`, `role`, an `extension` inside a phone | `400`, naming it: `role`, `phones.0.extension` |
| Names | `José`, `R2D2`, `Bob!`, `--`, 51 characters, a curly apostrophe | `400` |
| Names at the limit | `O`, 50 characters, `O'Brien`, `Mary Ann`, `Jr.` | `201`: accepted, as they should be |
| Email | `ann.example.com`, `ann@`, over 254 characters | `400` |
| Date of birth | `05/17/1990`, month 13, a future date, **turns 18 tomorrow** (the clock is frozen, so the result never depends on the day the tests run) | `400`; turns 18 today → `201`; born Feb 29 → turns 18 on Mar 1 |
| Phones | None, 4, two mobiles, two primaries, no primary, area code `0` or `1`, `+44 20 7946 0958`, type `fax` | `400` |
| Addresses | State `XX`, ZIP `1234` / `12345-6789`, `Apt 4/B`, 101-character street, two home addresses | `400` |
| Error body | Every error has `field` and `message`; `<script>` and `<img>` in the input **never come back** in the response | Safe to display |
| Update | Same rules as create: no phones, or an unknown field | `400` |

### B. Query strings: 18 tests ([`query.test.ts`](../tests/bad-calls/query.test.ts))

| Group | Example cases | Result |
|---|---|---|
| List | `sort=firstName`, `page=0`, `page=1.5`, `pageSize=101`, an empty `search=` | `400` |
| Get one | `view=full`, `includeDeleted=yes` | `400` |
| Unknown parameters | `?pagesize=5` (a typo of `pageSize`), on **every** operation | `400`, naming it, instead of silently ignoring the typo |

### C. Ids: 9 tests ([`ids.test.ts`](../tests/bad-calls/ids.test.ts))

| Group | Example cases | Result |
|---|---|---|
| Not a UUID | `/v1/users/abc` on get, update, delete, and restore | `400` |
| Doesn't exist | A random UUID on all four | `404` |
| Already deleted | Deleting the same user twice | `404` |

### D. Versions: 8 tests ([`versions.test.ts`](../tests/bad-calls/versions.test.ts))

| Group | Example cases | Result |
|---|---|---|
| Missing `If-Match` | Update or delete without saying which version | `428` |
| **Stale version** | Admin A saves; admin B saves with the version from before A's save | `412`, and A's change is still there |
| Malformed | `1` without quotes, `W/"1"`, `*`, `"one"` | `412` |

### E. Conflicts: 4 tests ([`conflicts.test.ts`](../tests/bad-calls/conflicts.test.ts))

| Case | Result |
|---|---|
| Create `ANN@Example.com` when `ann@example.com` exists | `409` (emails match ignoring case) |
| Create with a **deleted** user's email | `409`, suggesting restore instead |
| Change a user's email to another user's | `409` |
| Restore a user who isn't deleted | `409` |

### F. Paths and headers: 12 tests ([`paths.test.ts`](../tests/bad-calls/paths.test.ts))

| Group | Example cases | Result |
|---|---|---|
| Unknown path | `/`, `/v1/nope`, `/v2/users` | `404` |
| Wrong method | `PATCH /v1/users/{id}`, `GET /v1/users/{id}/restore` | `405`, with `Allow: GET, PUT, DELETE` telling the client what does work |
| No stray ETags | Lists and errors | No `ETag` header, so a client can't mistake one for a version |

## What the bad-call tests found

Written before the code changes, they ran red first: 112 of 127 passed at once, because most rules were built along with the operations. The failures were the new rules, plus **one real gap**:

- **Unknown fields were reported as `body`**, not by name. A client couldn't tell which field to remove. Fixed, while making sure a field *named* `<script>` is never echoed back.

See [journal row 30](journal.md).

## Security: 60 tests

Every `401` looks the same (`"A valid admin token is required"`, `WWW-Authenticate: Bearer`), whatever the reason, so an attacker learns nothing from trying.

### A. Tokens: 23 tests ([`tokens.test.ts`](../tests/security/tokens.test.ts))

| Group | Example cases | Result |
|---|---|---|
| No usable token | No header; `Basic` credentials; a valid token with the wrong scheme or no scheme; `Bearer abc` | `401` |
| **Forged or untrusted** | Signed with a guessed secret; **unsigned (`alg: none`)**; right secret but HS512; **a non-admin token edited to say `admin`**; expired; not valid yet; **no expiry at all** | `401` |
| Not an admin | Role `user`, no role, `Admin` (wrong case), `["admin"]` (a list) | `403` |
| Scheme name | `bearer`, `BEARER` + a valid token | `200` (the standard says the scheme ignores case); the token lowercased → `401` |

### B. Auth before anything else: 12 tests ([`auth-first.test.ts`](../tests/security/auth-first.test.ts))

Without a token, a caller can't learn which ids exist, which rules apply, or what the API accepts.

| Without a token | A signed-in admin would get | Result |
|---|---|---|
| An unknown user id | `404` | `401` |
| An id that isn't a UUID; an unknown query parameter; an invalid body; **malformed JSON** | `400` | `401` |
| A body over 100 KB | `413` | `401` (the body isn't even read) |
| An update without `If-Match` | `428` | `401` |
| An unknown path / a wrong method | `404` / `405` with `Allow` | `401`, no `Allow` header |
| With a **non-admin** token: an unknown id, malformed JSON | `404`, `400` | `403` |
| A create with no token, then with a non-admin token | | Refused, and **nothing is saved** |

### C. Injection: 8 tests ([`injection.test.ts`](../tests/security/injection.test.ts))

| Case | Result |
|---|---|
| `search=%`, `search=_` (SQL wildcards), `search=' OR '1'='1` | `200` with **0 matches**, not every user |
| `sort=lastName; DROP TABLE users`, `sort=lastName, password`, `order=asc --` | `400` (only values from the allowed list) |
| An id of `1' OR '1'='1` | `400` |
| `"__proto__": {"role": "admin"}` in the body | `400`, and no object in the server gains a `role` |

Storage is in memory today, so these pass easily. They're here for when it becomes PostgreSQL.

### D. Data leaks: 6 tests ([`leaks.test.ts`](../tests/security/leaks.test.ts))

| Case | Result |
|---|---|
| **A forced crash** on list, get, and create: storage throws an error containing SQL, a file path, and a stack trace | `500` "Something went wrong"; **none of it reaches the response**, but the server log has the real error |
| Any response: success, `401`, `404` | No `X-Powered-By` header naming the framework |

### E. CORS: 9 tests ([`cors.test.ts`](../tests/security/cors.test.ts))

| Case | Result |
|---|---|
| The allowed web page | CORS headers naming **exactly** that origin, never `*` |
| Another site; **a look-alike** (`admin.example.com.evil.com`); the allowed host over `http`; the `null` origin | No CORS headers, so the browser blocks the page from reading the response |
| A preflight from the allowed page, with no token | `204`, allowing `Authorization` |
| A `401` to the allowed page | Still has CORS headers, so the web client can tell the admin to sign in again |

### F. Body size: 2 tests ([`body-size.test.ts`](../tests/security/body-size.test.ts))

| Case | Result |
|---|---|
| A body over 100 KB | `413` "Request body must be 100 KB or smaller" |
| A body just under 100 KB | Read normally, then `400` for the 90,000-character name |

## What the security tests found

Written before the code changes, with the failures predicted in advance: **49 of 60 passed at once**, and the 11 failures were exactly the predicted ones. Two were **real holes**:

- **A token with no expiry was accepted.** The token library only checks `exp` when it's there, so a leaked token without one would have worked forever. `exp` is now required.
- **Every response said `X-Powered-By: Express`**, telling attackers which framework to target. Turned off.

And three corrections:

- **Malformed JSON got `400` before auth ran**, telling a caller with no token something about the API. Auth now runs before the body is read.
- **An oversized body got `400` "must be valid JSON"**, which was untrue. Now `413` with an honest message.
- **`bearer` in lowercase was refused**, though the HTTP standard allows it. Now accepted.

See [journal row 31](journal.md).

## How the tests are written

- **Red first.** Each test runs and fails for the expected reason before the code exists (details in [decision 03](decisions/03-test-strategy.md#how-the-bad-call-tests-are-written)).
- **Failures predicted.** Before each red run, the AI writes down which tests will fail and why; a surprise means someone misunderstood the code.
- **Real failures without breaking the app.** A `500` is forced by handing the app a storage layer that throws ([decision 03](decisions/03-test-strategy.md#how-the-security-tests-are-written)).
- **Table-driven.** Similar cases share one test with one line per case, so adding a case is one line.
- **Isolated.** Every test gets a fresh app with empty in-memory storage; no test depends on another.
- **Through the API only.** Tests set up data the way an admin would (by calling the API), never by reaching into storage.
