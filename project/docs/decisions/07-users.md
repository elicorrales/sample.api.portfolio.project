# 07 — Users

**Date:** 2026-09-12 · **Status:** Decided

## Operations

- Create a user
- List users
- Get one user
- Update a user
- Delete a user
- Restore a deleted user

## Fields

| Field | Required | Rules | Origin |
|---|---|---|---|
| First name | Yes | | picked |
| Last name | Yes | | picked |
| Email | Yes | Unique; matching ignores case; **never reused**, even after delete | picked (never reused: mine) |
| Date of birth | Yes | Not in the future; age 18 or older | picked (age 18: mine) |
| Created / updated timestamps | Automatic | | suggested |
| Version | Automatic | For optimistic locking | suggested |

**Why never reuse emails:** a user is closely tied to their email. Reuse would also make restore ambiguous.

## Views

**Origin:** mine

| View | Fields |
|---|---|
| Basic | id, first name, last name, email |
| Detailed | Basic, plus date of birth, phones, and addresses |

Keeping date of birth out of the basic view is also a privacy benefit.

## Listing

| Feature | Decision | Origin |
|---|---|---|
| Search | One partial-match term checked against first name, last name, and email; ignores case | mine |
| Sort | Last name or email, ascending or descending | mine |
| Tie-breaker | Then first name, then id, so order is stable across pages | suggested |
| Paging | Yes | picked |
| Deleted users | Hidden unless the admin asks to include them | mine |

**Search notes:**

- Partial matching is fine for thousands of rows. At scale, PostgreSQL trigram indexes speed it up. That's a good performance-test story.
- `%` and `_` in search text must be treated as plain characters, not wildcards. That's a security test.

## Update: PUT vs PATCH

| | PUT (replace whole user) | PATCH (change some fields) |
|---|---|---|
| Validation | Same rules as create | Every field optional; more rules and tests |
| Meaning | Clear: this *is* the user now | Needs rules for "leave unchanged" vs "clear" |
| A field accidentally left out | Wiped, or the request fails | Left alone |
| Two admins at once | Last write wins | Less clash on different fields |
| Web client: full edit form | Natural fit | Must track changed fields |
| Web client: edit one field in place | Must re-send everything | Natural fit |

**How locking changed the answer:** PATCH's main advantage was fewer clashes between admins. Once optimistic locking was chosen, both styles were equally safe, so PUT's simpler validation won.

**Choice:** PUT. The request sends all fields plus the version it loaded.

**Origin:** changed. I asked for pros and cons from both the API and the future web client's point of view. The AI recommended PATCH; I held off, and chose PUT once locking was settled.

## Locking

**Requirement:** only one admin's edit to a user can succeed at a time. Nobody silently overwrites anyone. **Origin:** mine

| | Lock first (pessimistic) | Check on save (optimistic) |
|---|---|---|
| How | Admin checks out the user; others wait | Anyone edits; a stale save is rejected ("changed since you loaded it") |
| API needs | Lock and unlock operations, expiry, force-unlock | A version number per user |
| Web client | Show lock holder; release when the tab closes | Show conflict; reload |
| Problem cases | Abandoned locks | The losing admin re-enters their edits |
| Common in web APIs | Less | Standard |

**Choice:** optimistic. **Origin:** suggested (I asked for locking; the AI laid out both kinds and recommended optimistic)

## Delete

| Question | Choice | Origin |
|---|---|---|
| Permanent, or mark as deleted? | Mark as deleted and keep the record | picked |
| Restore? | Yes, for admin mistakes | picked (reason: mine) |
| Effect on phones and addresses | Hidden along with the user, and restored with them | mine |
| Create with a deleted user's email | Fails. The error can suggest restoring instead. | mine (follows from no reuse) |

## Field details (spec piece 2)

| # | Question | Choice | Why | Origin |
|---|---|---|---|---|
| 1 | Name length | **1–50 characters per field** (first and last separately), after trimming spaces | Real-world references: UK government standard uses 35; many systems use 50. Covers long real names like `García-Fernández de la Torre`. | **changed** (AI first suggested 100; I asked what's realistic) |
| 2 | Allowed name characters | Letters in any language (including accents), spaces, hyphens, apostrophes (`'` and `’`), periods; at least one letter | Avoids blocking real people: José, Nguyễn, O'Brien, de la Cruz, one-letter names | suggested (prompted by my question) |
| 3 | Email max length | 254 characters | Practical limit from the email standards | suggested |
| 4 | Default sort | Last name, ascending | Natural for a people list | suggested |
| 5 | Default view for "get one user" | Basic; detailed must be asked for | Matches the list view, and keeps date of birth private by default | suggested |
| 6 | How "deleted" is shown | `deletedAt` timestamp (`null` if active), only when including deleted users | Says both whether and when | suggested |
| 7 | Unknown fields in the body (e.g. `id`, `role`) | Rejected with `400` | Safer; catches client typos; easy to test | suggested |

**Name pattern check:** tested against sample names before accepting.

| Accepted | Rejected |
|---|---|
| José, Zoë, Nguyễn, O'Brien, D’Angelo, García-Fernández de la Torre, Mary Ann, Jr., O, 't Hooft | `--`, `...`, `R2D2`, `Bob!`, empty |

The curly apostrophe (`’`) is allowed because phone keyboards often insert it instead of `'`.

## Test edge cases

- Turned 18 today → allowed; turns 18 tomorrow → rejected
- Born February 29
- `Bob@x.com` vs `bob@x.com` → same email
- Stale version on update → conflict
- Get or update a deleted user → not found (unless including deleted)
