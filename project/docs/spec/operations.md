# Operations (plain language)

**Date:** 2026-09-12 · **Status:** Reviewed

Every operation the API offers, described without technology. This is the step between the decisions ([decision log](../decisions/README.md)) and the formal OpenAPI file.

Writing this list surfaced a few new questions; see [Questions raised while writing](#questions-raised-while-writing).

## Applies to every operation

- The caller must be an **admin**
- **Rate limits** apply
- Failures fall into a small set of kinds, each reported the same way:

| Failure | Meaning |
|---|---|
| Invalid input | Missing, malformed, or rule-breaking fields |
| Not signed in | No valid token |
| Not allowed | Signed in, but not an admin |
| Not found | No such record, or it's hidden because the user is deleted |
| Conflict | Breaks a uniqueness rule, or the record changed since it was loaded |
| Too many requests | Rate limit hit |

## Users

### 1. Create a user

| | |
|---|---|
| **Give** | First name, last name, email, date of birth |
| **Get back** | The new user (detailed view), including id, version, and timestamps |
| **Fails when** | Any field is missing or invalid · date of birth is in the future or the user is under 18 · email is already used by any user, **including deleted ones** (the message suggests restoring) |

### 2. List users

| | |
|---|---|
| **Give** (all optional) | Search text · sort by last name or email · ascending or descending · page number · page size · include deleted users |
| **Get back** | One page of users (basic view) plus paging info: total count, current page, page size |
| **Behavior** | Search is a partial match, ignoring case, across first name, last name, and email · ties sort by first name, then id · deleted users hidden unless requested |
| **Fails when** | Unknown sort field · invalid page number or page size |

### 3. Get one user

| | |
|---|---|
| **Give** | User id · view: basic or detailed · include deleted (optional) |
| **Get back** | The user. The detailed view includes date of birth, phones, and addresses. |
| **Fails when** | Not found, or deleted and "include deleted" isn't set |

### 4. Update a user (replace)

| | |
|---|---|
| **Give** | User id · all four fields · the version I loaded |
| **Get back** | The updated user with a new version number |
| **Fails when** | Not found or deleted (restore first) · any field invalid · email belongs to another user · **version is out of date** (someone changed it since I loaded it) |

### 5. Delete a user

| | |
|---|---|
| **Give** | User id · the version I loaded |
| **Get back** | Confirmation |
| **Behavior** | Marked as deleted, not removed. Their phones and addresses become hidden. |
| **Fails when** | Not found or already deleted · version is out of date |

### 6. Restore a user

| | |
|---|---|
| **Give** | User id |
| **Get back** | The restored user, with phones and addresses visible again |
| **Fails when** | Not found · user isn't deleted (conflict) |

## Phones

All phone operations happen **under one user**. If the user doesn't exist or is deleted, the result is *not found*.

### 7. Add a phone

| | |
|---|---|
| **Give** | User id · number (U.S.) · type (mobile, home, work) · primary: yes or no |
| **Get back** | The new phone, including its id and version |
| **Behavior** | If primary is yes, the user's previous primary phone is un-set |
| **Fails when** | Invalid number or type · the user already has a phone of this type |

### 8. List a user's phones

| | |
|---|---|
| **Give** | User id |
| **Get back** | All the user's phones (at most 3), primary first |
| **Behavior** | No paging, search, or sort; there are never more than 3 |

### 9. Get one phone

| | |
|---|---|
| **Give** | User id · phone id |
| **Get back** | The phone |
| **Fails when** | The phone doesn't exist **or belongs to a different user** |

### 10. Update a phone (replace)

| | |
|---|---|
| **Give** | User id · phone id · number · type · primary · the version I loaded |
| **Get back** | The updated phone |
| **Behavior** | Setting primary to yes un-sets the previous primary |
| **Fails when** | Same rules as adding · the phone belongs to a different user · version is out of date |

### 11. Delete a phone

| | |
|---|---|
| **Give** | User id · phone id |
| **Get back** | Confirmation |
| **Behavior** | **Permanent.** If it was the primary, the user has no primary phone until one is set. |
| **Fails when** | The phone doesn't exist or belongs to a different user |

## Addresses

The same five operations and rules as phones (**12–16**: add, list, get one, update, delete), with these differences:

| | Phones | Addresses |
|---|---|---|
| Fields | Number, type, primary | Street, street line 2 (optional), city, state, ZIP, type, primary |
| Types | mobile, home, work | home, work, mailing |
| Validation | U.S. number in any common format; returned as `+13055551234` | State is a valid 2-letter code (states, DC, and territories) · ZIP is exactly 5 digits |
| Same value twice on one user | Allowed under different types (e.g. mobile = work) | Allowed under different types (e.g. home = mailing) |

The duplicate rule was dropped while writing the spec; see [08](../decisions/08-phones-addresses.md#details-and-a-reversal-spec-piece-3).

## Questions raised while writing

All five proposals were accepted as-is. **Origin:** suggested

| # | Question | Choice | Why |
|---|---|---|---|
| 1 | Does **list users** return the basic or the detailed view? | Basic only; detailed comes from "get one user" | Keeps lists small; date of birth stays out of bulk results |
| 2 | Does **delete user** require the version I loaded? | Yes | Prevents deleting a user based on an out-of-date screen |
| 3 | Restoring a user who isn't deleted | Conflict | Tells the caller something is off, instead of silently doing nothing |
| 4 | Do phones and addresses use **optimistic locking** (version) like users? | Yes | Same "no silent overwrite" rule everywhere; one pattern for the web client |
| 5 | Order of a user's phones and addresses | Primary first, then by type | Predictable display in the web client |
