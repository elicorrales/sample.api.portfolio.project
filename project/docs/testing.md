# Tests

**What the API refuses matters more than what it accepts.** Anyone can show that valid input works. Most of this test suite proves the opposite: bad input, stale versions, conflicts, wrong paths, forged tokens, attacks, and floods all fail the right way, with a clear error and no damage.

**Last updated:** 2026-09-13 · **218 tests, all green, running against a real PostgreSQL 18 server**

## By category

Most important first. The categories come from [decision 03](decisions/03-test-strategy.md#test-categories).

| Category | What it proves | Tests | Status | Folder | Run it (from `project/`) |
|---|---|---|---|---|---|
| **Bad calls** | Every kind of client mistake is rejected with the right status and a useful error | **115** | ✅ Green | [`tests/bad-calls/`](../tests/bad-calls/) | `npm run test:bad-calls` |
| **Security** | Forged, expired, or missing tokens get nothing; auth runs before anything else; injection, data leaks, and other origins are blocked | **60** | ✅ Green | [`tests/security/`](../tests/security/) | `npm run test:security` |
| **Integrity** | Two admins at once can't corrupt data or silently overwrite each other; a failed save changes nothing; the database refuses bad data even if the code lets it through | **14** | ✅ Green (on a real PostgreSQL server, with truly simultaneous connections) | [`tests/integrity/`](../tests/integrity/) | `npm run test:integrity` |
| **Rate limiting** | Too many requests get `429` with `Retry-After`, not a slow or crashed server; token-guessing floods and faked IPs are stopped too | **12** | ✅ Green | [`tests/rate-limit/`](../tests/rate-limit/) | `npm run test:rate-limit` |
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

Written when storage was in memory, where they passed easily. **Since the move to PostgreSQL they run against real SQL**: `ILIKE` with escaped wildcards, and every value sent as a query parameter. They still pass.

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

## Integrity: 14 tests

The API **checks, then saves**, in separate steps. Two requests can both pass the check ("is this email free?", "is this still version 1?") before either one saves. These tests force exactly that, every run: a test-only repository holds both requests right after their check, then releases them together ([decision 03](decisions/03-test-strategy.md#how-the-integrity-tests-are-written)).

### A. Two requests at once: 6 tests ([`races.test.ts`](../tests/integrity/races.test.ts))

| Race | Result |
|---|---|
| **Two creates with the same email** | One `201`, one `409`; exactly one user saved |
| Same, as `Ann@Example.com` and `ann@example.com` | One `201`, one `409` |
| **User B's email changed to one being created at that moment** | One of them `409`; exactly one user has the email |
| **Two admins save the same user from version 1** | One `200`, one `412`; version is 2, not 3; the saved user is the winner's |
| An update and a delete from the same version | One wins, the other `412`; exactly one of the two changes happened |
| Two restores of the same user | One `200`, one `409`; the version goes up once |

### B. One user never touches another: 2 tests ([`isolation.test.ts`](../tests/integrity/isolation.test.ts))

| Case | Result |
|---|---|
| Replace A's phones and addresses | B's are exactly as created (a missing `WHERE user_id = ...` would have wiped them) |
| Delete, then restore A | B unchanged, and listed the whole time |

### C. A failed save changes nothing: 2 tests ([`rollback.test.ts`](../tests/integrity/rollback.test.ts))

A trigger added by the test makes PostgreSQL refuse any address in `Failtown`. Addresses are saved last, so the failure lands **mid-save**, after the user and phones were already written.

| Case | Result |
|---|---|
| An update fails while saving addresses | `500`; name, version, phones, and addresses **exactly as before** |
| A create fails while saving addresses | `500`; **no half-saved user**; the same email works on the next try |

### D. The database's own rules: 4 tests ([`database-rules.test.ts`](../tests/integrity/database-rules.test.ts))

The last line of defense if the code ever has a bug. The API can't send this data, so these tests write SQL directly: the one agreed exception to "through the API only."

| Raw insert | Database's answer |
|---|---|
| A second primary phone | Refused (unique violation) |
| A second mobile phone | Refused (one per type) |
| Phone type `fax` | Refused (check constraint) |
| `ANN@Example.com` when `ann@example.com` exists | Refused (unique index on `lower(email)`) |

## What the integrity tests found

Failures predicted in advance: **3 of 14 failed, exactly the predicted ones.** One was a **real bug**:

- **Two requests with the same email at once got `500` instead of `409`.** Both passed the "is this email free?" check; the database's unique index then refused the second save, so **no duplicate was ever stored**, but that refusal reached the client as "Something went wrong." The same happened when an email change raced a create. Fixed: the repository recognizes that specific refusal, and the service answers the normal `409`.

The other 11 passed at once. The version check inside the `UPDATE` statement, the transactions, and the database rules were already right.

**Found along the way, not yet fixed:** the failing run printed the database error to the server log, and **that error includes the query's values: names, emails, dates of birth.** Callers never see it (responses stay generic), but a hosted server's logs shouldn't hold personal data. **Plan:** decide before hosting whether to log only the error code and constraint, or use a logging library that removes sensitive fields ([decision 11](decisions/11-database.md#found-along-the-way-personal-data-in-server-logs-open)).

See [journal row 34](journal.md).

## Rate limiting: 12 tests

100 requests per minute per client IP, counted in fixed one-minute windows ([decision 10](decisions/10-api-conventions.md), rows 23–27). The tests use a limit of 3 and a frozen clock, so they run instantly ([`rate-limit.test.ts`](../tests/rate-limit/rate-limit.test.ts)).

| Case | Result |
|---|---|
| Up to the limit | Normal responses |
| One over | `429`, Problem Details, `Retry-After: 60` |
| At 12:00:59 / at 12:01:00 | `Retry-After: 1` / allowed again |
| Blocked at 12:00:30 | `Retry-After: 30` (counts down to the window's end) |
| **3 guessed tokens, then a 4th** | `429`, not `401`: guessing floods are stopped before any token is checked |
| **3 guesses, then a valid admin token** from the same client | Still `429` |
| **A create while blocked** | `429`, and **nothing is saved** |
| Two clients behind a trusted proxy | Separate limits: A is blocked, B isn't |
| **A faked `X-Forwarded-For`** (no proxy trusted) | Ignored: still `429` |
| **A fake address added in front of the real one** (1 proxy trusted) | Only the address the proxy added counts: still `429` |
| A `429` sent to the allowed web page | Has CORS headers and exposes `Retry-After`, so the page can say "try again in 30 seconds" |
| 5 browser preflights (`OPTIONS`), then 3 requests | Preflights don't count; the 4th request is blocked |

**By hand:** 101 requests with `curl` gave `100 401` and `1 429`. The next request showed `Retry-After: 17` at 04:18:43, exactly the 17 seconds left in the window.

**1 of 12 passed at once**, as predicted. Only "up to the limit" can pass without a limiter; every other test checks that a `429` really happens. See [journal row 32](journal.md).

## How the tests are written

- **Red first.** Each test runs and fails for the expected reason before the code exists (details in [decision 03](decisions/03-test-strategy.md#how-the-bad-call-tests-are-written)).
- **Failures predicted.** Before each red run, the AI writes down which tests will fail and why; a surprise means someone misunderstood the code.
- **Real failures without breaking the app.** A `500` is forced by handing the app a storage layer that throws ([decision 03](decisions/03-test-strategy.md#how-the-security-tests-are-written)).
- **Table-driven.** Similar cases share one test with one line per case, so adding a case is one line.
- **Isolated.** One PostgreSQL server per run; each test file gets its own database in it (copied from a migrated template in milliseconds), emptied before every test. No test depends on another.
- **Storage-independent.** When storage moved from in-memory to PGlite, and again to a real PostgreSQL server, the tests ran unchanged. They caught the one real difference: phones came back in the wrong order ([decision 11](decisions/11-database.md#what-the-swap-found)).
- **One file at a time.** With PGlite, each file used about 1.1 GB and running 7 in parallel froze an 8 GB laptop. The shared server is far lighter, but the suite still runs one file at a time, in about 22 seconds.
- **Through the API only.** Tests set up data the way an admin would (by calling the API), never by reaching into storage.
