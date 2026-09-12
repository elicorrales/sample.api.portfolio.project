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
| Same number twice on one user | ~~Not allowed~~ **Allowed** under different types (reversed in spec piece 3; see below) | suggested |
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
| Same address twice on one user | ~~Not allowed~~ **Allowed** under different types (reversed in spec piece 3; see below) | suggested |

## Details and a reversal (spec piece 3)

Writing the phone and address endpoints into the spec surfaced these questions.

| # | Question | Choice | Why | Origin |
|---|---|---|---|---|
| 1 | Phone input format | **Flexible:** `3055551234`, `(305) 555-1234`, `305.555.1234`, `+1 305 555 1234`. Must be 10 digits; area code can't start with 0 or 1. | People type numbers many ways | suggested |
| 2 | Phone stored and returned format | **E.164** (`+13055551234`) | International standard; ready for other countries later; the web client formats for display | suggested |
| 3 | Work phone extensions | **None in version 1** | Easy to add later | suggested |
| 4 | Address field lengths | Street and street line 2: up to 100 each. City: up to 50. | Realistic, and blocks junk | suggested |
| 5 | U.S. territories | **Included:** AS, GU, MP, PR, VI, in addition to the 50 states + DC (56 codes) | They're U.S. addresses with state codes and ZIPs; Puerto Rico is common in U.S. data | suggested |
| 6 | **Duplicate rule** | **Dropped** for both phones and addresses | With one per type, a "duplicate" can only be the same value under two types, and **home = mailing** (or mobile = work) is common | suggested |
| 7 | Phone and address list shape | `{ items: [...] }` | Matches the user list, minus paging | suggested |
| 8 | `primary` in input | Required | PUT replaces everything; matches how user fields work | suggested |
| 9 | Does editing a phone or address change the user's version? | **No;** each record has its own version | Editing a phone shouldn't block someone else's edit to the user's name | suggested |
| 10 | Timestamps on phones and addresses | Yes (created, updated) | Matches users | suggested |

**About the reversal:** the duplicate rule was set earlier (from an AI suggestion) and looked reasonable on its own. It only showed up as a problem once combined with the later "one per type" rule, when writing the exact validation for the spec. That's one benefit of turning plain-language rules into a precise contract.
