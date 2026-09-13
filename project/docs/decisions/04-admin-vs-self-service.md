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

## Security tests

- No token → `401`
- Bad or expired token → `401`
- Valid token without the admin role → `403`
- Extra body fields (`id`, `createdAt`) are ignored or rejected
- Errors don't leak stack traces or SQL
- SQL injection attempts do nothing harmful
