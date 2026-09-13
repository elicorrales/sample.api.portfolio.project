# 04 — Admin API vs self-service

**Date:** 2026-09-12 · **Status:** Decided

## Question

Who owns the data?

| Option | Meaning |
|---|---|
| Admin API | One kind of caller (admin) manages all users |
| Self-service | Each user manages only their own profile, phones, and addresses |

## Choice

**Admin API first.** Self-service may come later.

**Why:** Self-service brings individual logins and passwords. Starting with admin keeps version 1 focused.

**Origin:** picked (self-service as a later phase: mine)

## What this changes

| Area | Effect |
|---|---|
| Auth | Still required, with one role: admin |
| Isolation tests | About **data integrity**, not user-vs-user ownership |
| Security tests | About **admin vs everyone else** |
| Self-service later | Adds a second role plus ownership rules. If auth is set up well, this adds to the code instead of rewriting it. |

## Auth mechanism

| Option | Pros | Cons |
|---|---|---|
| Static API key header | Simplest | Nothing carries over to self-service |
| **JWT with `role: admin`** | The same system works later; just add a `user` role | Slightly more setup |

**Choice (proposed):** JWT. Tests can create tokens directly, so no login endpoint is needed yet.

**Origin:** suggested

## Integrity tests (admin API)

- Two admins update the same user at once → no silent lost update (see optimistic locking in [07](07-users.md))
- Two creates with the same email at once → exactly one succeeds
- Simultaneous changes to different users don't leak into each other
- ~~A phone can't be reached through another user's path: `/users/2/phones/{phone-of-user-1}` → `404`~~ No longer applies: phones and addresses have no paths of their own ([08 revision](08-phones-addresses.md#revision-one-user-form-one-save))
- Saving one user never changes another user's phones or addresses
- Deleting a user hides their phones and addresses

**Built 2026-09-13:** 14 tests in `tests/integrity/`, on PGlite ([11](11-database.md#integrity-tests-2026-09-13)); see the [test showcase](../testing.md#integrity-14-tests). The first two ideas are covered by forcing the race; truly simultaneous database connections wait for native PostgreSQL.

## Security tests

- No token → `401`
- Bad or expired token → `401`
- Valid token without the admin role → `403`
- Extra body fields (`id`, `createdAt`) are ignored or rejected
- Errors don't leak stack traces or SQL
- SQL injection attempts do nothing harmful

**Built 2026-09-13:** 60 tests in `tests/security/`; see the [test showcase](../testing.md#security-60-tests).

## Auth details (security tests)

**Date:** 2026-09-13

Settled while planning the security tests, or found by them.

| # | Question | Options | Choice | Why | Origin |
|---|---|---|---|---|---|
| 1 | Malformed JSON from a caller with no token | `400` (body read first), or `401` | **`401`: auth runs before the body is read** | Nothing should be answered before auth, not even "your JSON is bad" | suggested; I asked that a test enforce it |
| 2 | `bearer` in lowercase | `Bearer` only, or any case | **Any case** | The HTTP standard (RFC 9110) says the scheme name ignores case; the token itself is still checked exactly, so there's no security cost | suggested (after I asked for an explanation) |
| 3 | A signed token with no `exp` | Accept, or `401` | **`401`: `exp` is required** | Found by the tests: the token library only checks `exp` when present, so a leaked token without one would work forever | suggested (gap found by the tests) |
| 4 | A signed token with no `role` | `401`, or `403` | **`403`** | The token is genuine, so the caller is signed in, just not allowed | suggested |
| 5 | Expose `WWW-Authenticate` to browser code via CORS | Yes, or no | **No** | Swagger UI didn't show it, which raised the question. The web client doesn't need it: a `401` already means "sign in again". | suggested; I agreed (`401` is sufficient) |
