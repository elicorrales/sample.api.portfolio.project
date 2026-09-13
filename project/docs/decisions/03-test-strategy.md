# 03 — Test strategy

**Date:** 2026-09-12 · **Status:** Decided

## Approach

**Origin:** mine. API-first and test-first:

1. Specify the public interface (the contract)
2. Write tests against it and confirm they fail
3. Build until they pass

## Test categories

**Origin:** mine (rate limiting replaces DDoS: suggested, and I confirmed)

| Category | What it checks | Fake DB OK? | Tooling |
|---|---|---|---|
| Happy path | Does what it's supposed to | Yes | Vitest + Supertest |
| Bad calls | Missing, invalid, or extra params; wrong paths | Yes | Vitest + Supertest |
| Integrity / concurrency | No lost updates or race conditions; simultaneous operations | **No** — real races need a real DB | ~~Real Postgres (Docker)~~ PGlite for single-connection checks, native PostgreSQL for true concurrency ([database path](#database-path-for-tests)) |
| Security | Auth, permissions, injection, data leaks | Mostly | Vitest + Supertest |
| Performance | Speed under load | No | k6 or autocannon, separate from the test suite |
| Rate limiting | Too many requests → `429` | Yes | Vitest + Supertest |

## How the bad-call tests are written

**Date:** 2026-09-13 · **Origin:** suggested; I agreed

| Question | Choice | Why |
|---|---|---|
| Many similar cases (e.g. 12 bad phones) | **Table-driven** with `it.each`: one line per case | Easy to read and extend; each failure names its case |
| Date-of-birth boundaries ("turns 18 today") | **Freeze the clock** in those tests (`vi.setSystemTime`) | The result can't change depending on the day the tests run |
| Layout | `tests/bad-calls/`, one file per group: body, query, ids, versions, conflicts, paths | Each group maps to one kind of mistake a client can make |
| Run order | Write all the tests, run them red, then change the code | 112 passed at once (rules already built); the 15 failures were exactly the new rules and one gap |

## How the security tests are written

**Date:** 2026-09-13 · **Origin:** suggested; I agreed

| Question | Choice | Why |
|---|---|---|
| Layout | `tests/security/`, one file per area: tokens, auth-first, injection, leaks, CORS, body size | Each file maps to one kind of attack |
| Forging tokens | Build them in the test with `jose`: wrong secret, `alg: none`, HS512, an edited payload, no `exp` | Tests the real verification code, not a mock of it |
| Reaching a `500` | Pass `createApp()` a **fake repository whose methods throw** an error full of SQL and file paths, then check none of it reaches the response | No normal request causes a `500`. No app changes were needed, because the app already takes its repository as an argument (dependency injection). |
| The logged error | Silence `console.error` in that test, but check it was called with the real error | Logs are for us; responses are for callers |
| CORS | Build the app with one allowed origin, then try look-alikes (`admin.example.com.evil.com`, `http://`, `null`) | Catches loose origin matching |
| Injection with in-memory storage | Write the tests anyway (`%`, `_`, `' OR '1'='1'`, SQL in `sort`) | They pass trivially today; they start to matter when PostgreSQL arrives |
| Run order | Same as bad calls: all tests first, predict the failures, run red, change the code | 49 of 60 passed at once; the 11 failures were exactly the predicted ones |

## How the rate-limit tests are written

**Date:** 2026-09-13 · **Origin:** suggested; I agreed

| Question | Choice | Why |
|---|---|---|
| Waiting for a window to end | **Fake only `Date`** (`vi.useFakeTimers({ toFake: ["Date"] })`) and jump the clock: 12:00:00, 12:00:30, 12:01:00 | Tests run instantly and `Retry-After` is exact. Faking all timers would stall Supertest |
| The limit in tests | `createApp({ rateLimit: { limit: 3, windowSeconds: 60 } })` | 3 requests reach the limit; 100 would be slow and noisy |
| Two different clients | Trust 1 proxy and send different `X-Forwarded-For` values | Supertest always connects from the same address |
| No test passes by accident | Every test except "up to the limit" checks that a `429` really happens | Otherwise "allowed again after the window" passes with no limiter at all |
| Checking by hand | A `curl` loop of 101 requests, not Swagger | Clicking 101 times isn't realistic |

## How the integrity tests are written

**Date:** 2026-09-13 · **Origin:** suggested; I agreed

| Question | Choice | Why |
|---|---|---|
| Two requests "at once" | `RacingRepository` (a test helper) wraps the real repository; `holdUntil("findByEmail", 2)` holds calls until 2 arrive, then releases both | The race happens every run, not by timing luck |
| Which request wins | Not fixed, so tests check the **pair** of statuses (`[201, 409]`) and that exactly one change was saved | Either order is correct; only "both succeed" or "both fail" is wrong |
| A save failing partway | The test adds a PostgreSQL trigger that refuses one city, then removes it afterward | Real rollback of real rows |
| The database's own rules | Raw SQL inserts, checked by PostgreSQL error code (`23505` unique, `23514` check) | The only way to reach them; an agreed exception to "through the API only" |
| Truly simultaneous connections | Not yet | PGlite takes one connection; that's stage 3 (native PostgreSQL) |

## Stubbing the database

**Question:** Test only the Node layer at first, then all layers later?

**Choice:** Yes, in two levels:

| Level | Tests | Database |
|---|---|---|
| Fast | Node code: routes, validation, business rules | In-memory fake repositories |
| Full | All layers | Real PostgreSQL |

**Why:** Put data access behind a small repository layer, so tests can swap in a fake. Mocking Prisma directly is painful.

**Origin:** mine (repository approach: suggested)

## Database path for tests

**Constraint:** no Docker, and little disk space on both my laptop and the dev VM.

**Question:** How do tests get a real PostgreSQL without Docker?

| Option | What it is | Disk | Limit |
|---|---|---|---|
| Docker | Run PostgreSQL in a container | Large (Docker itself) | Not installed; no room |
| **PGlite** | Real PostgreSQL compiled to run inside Node (npm package) | A few MB | One connection at a time, so no truly simultaneous requests |
| Neon (free hosted) | Hosted PostgreSQL | None | Needs internet |
| **Native install** | Regular local PostgreSQL server | ~100–200 MB | None for this project |

**Choice:** a staged path, keeping the real database as late as possible.

| Stage | Database | Status |
|---|---|---|
| 1 | In-memory fakes | ✅ Done; removed at stage 2 |
| 2 | PGlite (real SQL, tiny) | ✅ **Done 2026-09-13**, with Drizzle ([11](11-database.md)) |
| 3 | Remove PGlite; native PostgreSQL install, which also handles the integrity/concurrency tests | ⏳ |

**Origin:** mine (Neon was suggested for concurrency tests; I chose a native install instead)

**Considered: MariaDB instead of PostgreSQL.** Kept PostgreSQL:

- Render offers managed PostgreSQL but not MariaDB
- Free hosted PostgreSQL options exist (Neon, Supabase)
- Native disk footprint is similar; Docker was the real space cost
- Earlier decisions (search index, hosting) already assume PostgreSQL

**Where Docker could still appear:** only in CI later (GitHub Actions can start PostgreSQL on GitHub's machines). Never on my machines.

## Why a test runner instead of plain `node`

Plain `node test.js` works, but a runner adds assertions, named tests, setup/teardown, run-all, watch mode, readable failures, mocking, and coverage.

Node also has a built-in runner (`node --test`), so this is a preference, not a requirement. See [01](01-ai-cross-check.md).

## Formal spec review: skipped

**Question:** Once all 16 operations were in the spec, should I do a formal read-through review before moving on?

**Choice:** No. Move to test setup.

**Why:**

- It's greenfield: nothing depends on the spec yet, so changes are cheap
- Writing tests is a review in itself; every rule becomes a concrete check
- The future admin web client will expose usability gaps no read-through would find
- Automated tests cover what manual testing in the web client can't: concurrent edits, rate limits, bad or missing tokens, injection, and edge cases like Feb 29 birthdays

**Origin:** mine (I pushed back on the suggested review)

**Spec versioning:** the spec stays at **0.x** while it's still changing, and becomes **1.0.0** once the web client has proven it end to end. "V1" means verified, not just written. **Origin:** suggested

## Admin-specific test ideas

Admin-specific integrity and security tests are in [04](04-admin-vs-self-service.md). Field-level edge cases are in [07](07-users.md) and [08](08-phones-addresses.md).
