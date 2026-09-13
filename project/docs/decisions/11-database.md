# 11 — Database

**Date:** 2026-09-13 · **Status:** Decided (built: stages 2 and 3 of the [database path](03-test-strategy.md#database-path-for-tests); PGlite first, then a real PostgreSQL server, [below](#stage-3-a-real-postgresql-server-2026-09-13))

## Why now

In-memory storage loses everything on restart, and on Render that includes every deploy, crash, and free-tier sleep. I asked whether PGlite would fix that on Render: **no.** Render's disk is wiped too, unless it's a paid persistent disk. Data that survives needs a separate PostgreSQL server (Render PostgreSQL, Neon, or Supabase), picked at hosting time.

What this step buys anyway:

| Gain | With PGlite |
|---|---|
| All 204 tests run against real SQL | Yes |
| Injection tests hit real `ILIKE` and parameters | Yes |
| Database-enforced rules (unique email, one primary) | Yes |
| Integrity tests with truly simultaneous saves | **Partly:** PGlite takes one connection at a time. Full concurrency needs a native PostgreSQL (stage 3) |
| A hosted database later | Only a connection change in `shared/database.ts` |

## How the code talks to the database

**Question:** raw SQL, a query builder, or an ORM?

I first leaned toward raw SQL because I said I wanted to "test actual SQL." I then said that was too loose, and asked what employers expect and how Prisma hides SQL. (I know Hibernate/JPA from Java: Prisma is the same idea with a schema file instead of annotated classes; Drizzle is closer to jOOQ; migration files work like Flyway.)

The AI checked Prisma's current docs and issue tracker against what this project needs:

| Need | Prisma (checked 2026-09-13) |
|---|---|
| Run on PGlite | No official adapter ([issue open since 2024](https://github.com/prisma/prisma/issues/23752)); two community packages needed |
| Unique index on `lower(email)` | Not in Prisma 7; Prisma 8 adds expression indexes but is a release candidate |
| Partial index (one primary) | Preview feature in 7.4, with an [open bug](https://github.com/prisma/prisma/issues/29289) that drops hand-written partial indexes |

| Option | Strength | Cost |
|---|---|---|
| **Drizzle + PGlite** | Official PGlite support; SQL stays visible; both indexes declared in the schema | Less name recognition than Prisma |
| Prisma + native PostgreSQL | Prisma's official path | A local PostgreSQL install; `lower(email)` still hand-written |
| Prisma + PGlite via community packages | Prisma, no install | Fragile |

**Choice:** **Drizzle** (`drizzle-orm` 0.45.2, `drizzle-kit` 0.31.10) with **PGlite** (0.5.8). Pinned to stable releases; Drizzle 1.0 is still a release candidate. This replaces Prisma from [02](02-stack.md).

**Why:** the concrete gaps above, not a default. I don't need Prisma on my résumé and haven't used it.

**Origin:** suggested (I questioned the first pick, raw SQL, and asked for the Prisma check)

## Schema and rules

**Origin:** suggested; I agreed with all of them

| # | Question | Choice | Why |
|---|---|---|---|
| 1 | Migrations | **`drizzle-kit generate`** writes numbered SQL files (`api/migrations/0000_create_users.sql`) from `users.table.ts`; applied at startup | Plain SQL files in the repo, like Flyway; I reviewed the first one before it ran |
| 2 | Phones and addresses | **Separate tables** (`user_phones`, `user_addresses`) | The database itself enforces one per type (`PRIMARY KEY (user_id, type)`) and one primary |
| 3 | Saving them on update | **Delete and re-insert, in the same transaction** as the version-checked `UPDATE` | They have no ids, and the whole user is replaced anyway |
| 4 | Which rules the database enforces | **Data-protecting rules:** unique email, one per type, one primary, valid types (`CHECK`, built from the same lists Zod uses) | Formats and lengths stay in Zod; "at least one phone" spans rows, so it stays in the service |
| 5 | Case-insensitive unique email | `UNIQUE INDEX ... (lower(email))`, including deleted users | Emails are never reused |
| 6 | Sorting | `lower(last_name) COLLATE "C"` | PostgreSQL's usual text sorting can skip hyphens and spaces; `"C"` sorts exactly as before |
| 7 | Date of birth | `date` column read as a string (`mode: "string"`) | A JavaScript `Date` could shift it a day with the time zone |
| 8 | `%` and `_` in search | Escaped before `ILIKE`; every value sent as a parameter | They match only themselves |
| 9 | Column names | `snake_case` in the database, `camelCase` in the API | Each side's convention; the repository maps between them |

## Tests and local runs

| # | Question | Choice | Why | Origin |
|---|---|---|---|---|
| 10 | Fresh database per test | **One in-memory PGlite per test file**, `TRUNCATE users CASCADE` before each test | A new PGlite per request would mean hundreds of startups | suggested |
| 11 | The in-memory repository | **Deleted** | One real implementation to maintain; `createApp()` now requires a repository | suggested |
| 12 | `npm run dev` data | **Saved to `project/.data/`** (git-ignored); the server closes the database cleanly on Ctrl+C | Users survive a restart; I checked that in Swagger | suggested |
| 13 | Test files in parallel | **One at a time** (`maxWorkers: 1`), about 50 s | See below | mine (2 was offered; I chose 1, since 2 only bought speed) |

### The memory incident

The first full run **froze my laptop**: the test count stayed at 0, then the mouse pointer and terminal disappeared. We measured instead of guessing:

| Measure | Value |
|---|---|
| Laptop RAM | 7.5 GiB, 3.4 GiB available with the dev VM (2 GB) running |
| CPU cores | 8, so Vitest ran about 7 test files at once |
| Peak memory of one test file with its own PGlite | ~1.1 GiB (`/usr/bin/time -v`) |
| 7 at once | ~8 GiB: out of memory |

The AI had predicted "slower," not this. One worker at a time peaks around 1.2 GiB.

### Install warning accepted

`npm install` reported 4 moderate vulnerabilities. They're one advisory ([GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)) counted along a chain: `drizzle-kit` → `@esbuild-kit` → an old `esbuild` whose **development web server** can be read by other sites. `drizzle-kit` never starts that server, it's a dev dependency that never ships, and our own tools use a newer esbuild. `npm audit fix --force` would downgrade `drizzle-kit` to 0.18, so it isn't used. **Origin:** suggested

## What the swap found

The goal was that no test would change, since only storage changed. **203 of 204 passed on the first run.** The workflow test failed: after a restore, the primary *work* phone came back after the *mobile* one.

- **Cause:** the rule is "primary first, then by type." In-memory storage kept lists in the order the service saved them, so the rule held by accident. Database rows come back in no fixed order, and the new repository sorted by type only.
- **Why only one test caught it:** every other test's primary phone was also first by type (mobile).
- **Fix:** `sortByPrimaryThenType` moved next to the `Phone` and `Address` types in `users.repository.ts`; the service sorts with it before saving, and the PostgreSQL repository after loading. 204 green.

No test assertions changed. Two test files changed one setup line each, to get their app from the shared `testApp()` helper.

## Integrity tests (2026-09-13)

With a real database, integrity tests became possible. PGlite runs one query at a time, but the API **checks, then saves** in separate steps ("is this email free?" → insert), so two requests can both pass the check before either saves. That race is real on PGlite.

**Origin:** suggested; I agreed with all four

| # | Question | Choice | Why |
|---|---|---|---|
| 14 | Making two requests overlap | A test-only `RacingRepository` **holds each request right after its check until both arrive**, then releases them together | Firing two requests and hoping they overlap would pass or fail by luck |
| 15 | Where the duplicate-email database error becomes `409` | The PostgreSQL repository throws a named `EmailTakenError`; the service turns it into `409` | The repository stays free of HTTP; any other database error still becomes a `500` |
| 16 | Proving a failed save changes nothing | A **PostgreSQL trigger**, added only by the test, refuses addresses in `Failtown`. Addresses are saved last, so the failure lands mid-save | A real transaction and a real rollback, not a mock |
| 17 | Testing the database's own rules with raw SQL | **Allowed, as an exception** to "through the API only" | The API can't send that data; the tests prove the database protects it anyway if the code ever has a bug |

### What the tests found

**3 of 14 failed, exactly as predicted:** two creates with the same email at once, the same with different case, and changing one user's email to one being created at that moment. Each time, one request got **`500` instead of `409`**. The database did its job (its unique index refused the second save, so no duplicate was ever stored), but nothing translated that refusal into the error a client understands. Fixed with rows 15 above: 218 green.

The other 11 passed at once: the version check inside `UPDATE ... WHERE version = ...`, the transactions, and the database rules were already right.

### Found along the way: personal data in server logs (open)

The red run printed the failed database error, and **Drizzle's error includes the full query with its values**: names, emails, dates of birth. Nothing reaches callers (responses stay `"Something went wrong"`, [security D1](../testing.md#d-data-leaks-6-tests-leakstestts)), but logs holding personal data become a privacy problem once the API is hosted and logs are kept.

| Option | Effect |
|---|---|
| Log only the error's type, PostgreSQL code, and constraint name | Enough to debug; no values |
| A logging library with redaction (e.g. `pino` with `redact`) | Structured logs; sensitive fields removed by name |
| Leave as is | Fine locally; not once hosted |

**Status:** not yet decided. **To decide at the hosting step,** before real logs exist. **Origin:** suggested (spotted in the test output); I asked that it be recorded and showcased

## Stage 3: a real PostgreSQL server (2026-09-13)

PGlite ran one connection at a time and used ~1.1 GB per test file. A real PostgreSQL server fixes both, and it's what the hosted API will use.

### Where and how

I asked two things first: does the VM need it, and what's the smallest way?

| Question | Answer | Origin |
|---|---|---|
| VM or laptop? | **Laptop only.** Tests and `npm run dev` run there; the VM only writes code, typechecks, and generates migrations, none of which need a database | suggested (my question) |
| How to run it | **`embedded-postgres`** (dev dependency, 18.4.0-beta.17): real PostgreSQL 18 server binaries (~60 MB) inside `node_modules`, started and stopped from Node | suggested |

| Option | Size | sudo | Runs |
|---|---|---|---|
| **`embedded-postgres`** | ~60 MB, inside the repo | No | Only while tests or `npm run dev` run |
| `apt install postgresql` | System-wide | Yes | Always, as a system service |

**Why:** it keeps my standing rule, everything local to the repo and no global installs ([02](02-stack.md#confirmed-at-test-setup)). It's the same PostgreSQL server; only how it's started differs. The "beta" in its version is the wrapper package's own label; `18.4.0` is the PostgreSQL version.

**Does it carry over to hosting?** I asked. Everything except `embedded-postgres` does: the `pg` driver, Drizzle queries, and SQL migrations are the same. The API only reads `DATABASE_URL`; on Render, the host runs PostgreSQL. Two things to handle then: SSL (hosted databases usually require it) and matching the major version (18).

### Choices

**Origin:** suggested; I agreed

| # | Question | Choice | Why |
|---|---|---|---|
| 18 | Keep PGlite? | **Removed** | One database engine to maintain (the plan in [03](03-test-strategy.md#database-path-for-tests)) |
| 19 | Node driver | **`pg`** (node-postgres) 8.23.0 | The most common; Drizzle supports it directly |
| 20 | Test isolation | **One server per run** (Vitest global setup, port 54329, temp folder). A **template database** gets the migrations once; each test file copies it into its own database in milliseconds, empties it before each test, and drops it at the end | Real isolation without starting a server per file |
| 21 | `npm run dev` | `scripts/dev.ts` starts PostgreSQL (port 54320, data in `.data/postgres`), then the API with auto-restart; Ctrl+C stops both | One command, as before; the database survives code-change restarts |
| 22 | `DATABASE_URL` missing | The server refuses to start (like `JWT_SECRET`); it prints the database host, never the password | A missing setting on the host should fail loudly |
| 23 | Test files in parallel | **Still one at a time** | 22 s is fine; raising it would need a memory measurement first |

### Result

| | PGlite (stage 2) | PostgreSQL server (stage 3) |
|---|---|---|
| Tests | 218 green | **218 green, no test changed** |
| Suite time | ~65 s | **22 s** |
| Race tests | Requests forced to overlap, one connection | Same tests, **truly simultaneous connections**; PostgreSQL makes the second save wait for the first, then refuses it |

In Swagger: created a user, stopped `npm run dev` (it stopped immediately), started it again, and the user was still there. After the final Ctrl+C, `postmaster.pid` was gone from `.data/postgres`, which confirms PostgreSQL shut down cleanly rather than being killed.

**Code changes:** `shared/database.ts` (connects through `pg`), `server.ts` (`DATABASE_URL`), `tests/global-setup.ts` and `tests/helpers/database.ts` (server and per-file databases), `scripts/dev.ts`, `vitest.config.ts`. The repository and service didn't change.
