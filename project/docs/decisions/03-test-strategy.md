# 03 — Test strategy

**Date:** 2026-09-12 · **Status:** Mostly decided

## Approach

**Origin:** mine. API-first and test-first:

1. Specify the public interface (the contract)
2. Write tests against it and confirm they fail
3. Build until they pass

## Test categories

**Origin:** mine (rate limiting replaces DDoS: suggested)

| Category | What it checks | Fake DB OK? | Tooling |
|---|---|---|---|
| Happy path | Does what it's supposed to | Yes | Vitest + Supertest |
| Bad calls | Missing, invalid, or extra params; wrong paths | Yes | Vitest + Supertest |
| Integrity / concurrency | No lost updates or race conditions; simultaneous operations | **No** — real races need a real DB | Real Postgres (Docker), concurrent requests |
| Security | Auth, permissions, injection, data leaks | Mostly | Vitest + Supertest |
| Performance | Speed under load | No | k6 or autocannon, separate from the test suite |
| Rate limiting | Too many requests → `429` | Yes | Vitest + Supertest |

## Stubbing the database

**Question:** Test only the Node layer at first, then all layers later?

**Choice:** Yes, in two levels:

| Level | Tests | Database |
|---|---|---|
| Fast | Node code: routes, validation, business rules | In-memory fake repositories |
| Full | All layers | Real PostgreSQL |

**Why:** Put data access behind a small repository layer, so tests can swap in a fake. Mocking Prisma directly is painful.

**Origin:** mine (repository approach: suggested)

## Why a test runner instead of plain `node`

Plain `node test.js` works, but a runner adds assertions, named tests, setup/teardown, run-all, watch mode, readable failures, mocking, and coverage.

Node also has a built-in runner (`node --test`), so this is a preference, not a requirement. See [01](01-ai-cross-check.md).

## Admin-specific test ideas

Admin-specific integrity and security tests are in [04](04-admin-vs-self-service.md). Field-level edge cases are in [07](07-users.md) and [08](08-phones-addresses.md).
