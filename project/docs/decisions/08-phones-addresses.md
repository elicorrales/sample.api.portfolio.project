# 08 — Phones and addresses

**Date:** 2026-09-12 · **Status:** Decided

## Ownership

**Origin:** mine

- Every phone and address belongs to exactly one user and doesn't exist on its own.
- It is not shared. Two users at the same address get two separate address entries.
- So phones and addresses are **not unique** across users.

## Operations (per user)

- Add
- List
- Get one
- Update (PUT, same as users; see [07](07-users.md))
- Delete

## Delete: permanent or mark as deleted?

| | Mark as deleted | Delete permanently |
|---|---|---|
| Undo a mistake | Yes | No, re-type it |
| History | Kept | Lost |
| Every read filters deleted rows | Yes, more code and tests | No |
| Restore rules | More complicated | Simple |
| Privacy | Keeps data someone may want erased | Gone |

**Choice:** permanent.

**Why:** re-typing a phone or address is cheap. Deleting a *user* still hides their phones and addresses without marking each one.

**Origin:** suggested, and I agreed

## Phones

| Rule | Decision | Origin |
|---|---|---|
| Fields | Number, type, primary (yes/no) | picked |
| Region | U.S. numbers only | suggested |
| Types | mobile, home, work | suggested |
| Per type | One per type, so at most 3 per user | **changed** (suggested a limit of 10; I chose one per type) |
| Primary | At most one per user | suggested |
| Setting a new primary | Old primary is automatically un-set | suggested |
| Deleting the primary | No primary until the admin picks one (no auto-pick) | suggested |
| Same number twice on one user | Not allowed | suggested |
| Changing type to one already used | Conflict | suggested (follows from one per type) |

## Addresses

| Rule | Decision | Origin |
|---|---|---|
| Fields | Street, street line 2 (optional), city, state, ZIP, type, primary | picked; I dropped country (line 2 and type/primary: suggested) |
| Region | U.S. only | mine |
| Types | home, work, mailing | suggested (phone types don't fit addresses) |
| Per type | One per type, so at most 3 per user | **changed** (suggested a limit of 10; I chose 3, matching phones) |
| Primary | Same rules as phones | mine |
| State | Valid 2-letter code, including DC | suggested |
| ZIP | 5 digits only (no ZIP+4); leading zeros kept, e.g. `02134` | **changed** (suggested allowing ZIP+4; I chose 5-digit only) |
| Same address twice on one user | Not allowed; compared ignoring case and extra spaces | suggested |

**Known limitation:** "Main St" vs "Main Street" is not detected as a duplicate. Accepted for version 1.
