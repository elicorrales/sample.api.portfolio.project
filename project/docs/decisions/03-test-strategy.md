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
| Integrity / concurrency | No lost updates or race conditions; simultaneous operations | **No** — real races need a real DB | Real Postgres (Docker), concurrent requests |
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

| Stage | Database |
|---|---|
| 1 | In-memory fakes |
| 2 | PGlite (real SQL, tiny) |
| 3 | Remove PGlite; native PostgreSQL install, which also handles the integrity/concurrency tests |

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
