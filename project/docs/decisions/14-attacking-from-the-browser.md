# 14 — Attacking the demo from the browser

**Date:** 2026-09-13 · **Status:** Documented; **the ideas below are not built yet**

## How it came up

Once paging and search worked in the web client, I stopped to think like an attacker, and asked two things:

- **Could someone break the search box?** Bad data, too much text, SQL injection, other kinds of injection, special Unicode, and how the page recovers and shows errors and warnings. Not only in the Experiments tab, but in THE search box an admin uses
- **"If I was a hacker, what could I do in the browser's dev tools console to create havoc?"**

I asked for this to be written down **whether or not any of it gets built**, as a record that security was part of the thinking, not an afterthought.

## The starting point: the page is not the security boundary

Anything on the page can be changed by the person looking at it: remove a `maxlength`, edit React's state, or skip the page entirely and send requests from the console or `curl`. **Every check in the web client is for convenience and clear messages; the API's checks are the ones that count.** So the real question is what the API accepts from someone holding a valid token.

## What a visitor could try in dev tools, and what stops it

Each row was checked against the API's existing tests before being written here.

| Try | How | What happens | Proven by |
|---|---|---|---|
| **Take the token** | Network tab → any request → `Authorization: Bearer eyJ…` | **Works, by design.** The demo gives a 1-hour admin token to anyone, usable from anywhere | [05](05-hosting.md) (the demo token) |
| **Forge a better token** | Change the token's contents (role, expiry), keep the signature | `401`: the signature no longer matches | [`tokens.test.ts`](../../tests/security/tokens.test.ts) |
| **Get around the page's limits** | Delete the search box's `maxlength`, or `fetch` with a 101-character `search`, an empty `search`, or `pageSize=101` | `400`, naming the parameter | [`query.test.ts`](../../tests/bad-calls/query.test.ts) (B1) |
| **Sneak in fields** | Save a user with `"role"` or `"id"` in the body | `400`, naming the unknown field | [`body.test.ts`](../../tests/bad-calls/body.test.ts) (A3) |
| **Script injection** | Save a first name `<script>alert(1)</script>` or an email `<img src=x>` | `400`: names allow only letters, spaces, `-`, `.`, `'`; and React shows any text as text, never as HTML | [`body.test.ts`](../../tests/bad-calls/body.test.ts) |
| **SQL injection** | Search for `' OR '1'='1`, or `%` and `_` (SQL's wildcards); put SQL in `sort` or in an id | Search text matches only itself; SQL in `sort` or an id is refused | [`injection.test.ts`](../../tests/security/injection.test.ts) (C1, C3) |
| **Pollute objects** | `__proto__` in the body | Refused, and nothing is polluted | [`injection.test.ts`](../../tests/security/injection.test.ts) (C4) |
| **Overwrite someone's edit** | Save with an old `If-Match`, or none | `412` or `428` | [`versions.test.ts`](../../tests/bad-calls/versions.test.ts) |
| **Flood** | `for (let i = 0; i < 500; i++) fetch(…)` | `429` after 100 in a minute, **for their own address only** | [`rate-limit.test.ts`](../../tests/rate-limit/rate-limit.test.ts) |
| **Huge body** | Save a 5 MB body | `413`, refused before it's read | [`body-size.test.ts`](../../tests/security/body-size.test.ts) |
| **Change the page itself** | Edit React's state, the API address, or the token in memory | Changes only their own tab; a made-up token gets `401` | (only affects themselves) |

## What someone could still do: vandalize the shared demo data

This is the demo's real exposure. Nothing above breaks the API, but **every visitor holds an admin token and the data is shared.** With a short script staying under 100 calls a minute, someone could rename all users to something offensive, delete them all, or create users up to the 200 cap. **Other visitors would see it until the nightly reset at 08:00 UTC.**

Also: the rate limit counts **per IP address**, so someone with many addresses gets 100 calls a minute from each.

### Ideas to limit it (not decided, not built)

| Idea | Helps | Cost |
|---|---|---|
| Reset more often (hourly) | Vandalism lasts at most an hour | Real visitors' changes vanish sooner too |
| Cap writes per token (for example 30 changes an hour) | One token can't rewrite everything | Needs counting per token in the API; a new token is free, so it slows vandals rather than stopping them |
| Rate-limit getting tokens (for example 5 an hour per address) | Makes the previous idea stick | Visitors sharing an office address could block each other |
| A separate copy of the data for each token | One visitor can't affect another at all | A much bigger change: a database or schema per token, created and cleaned up |
| Leave it, and say so | Honest and simple; the data is fake and resets nightly | Someone may see vandalism for up to a day |

## Related: protecting the stored data

The attacks above are about what the API **accepts**. Protecting the data **where it's stored and moved** was thought through earlier, in [decision 12](12-encryption.md), before hosting:

| Layer | State |
|---|---|
| In transit | **Done:** HTTPS to the API; SSL between the API and the database over Render's private network; the database refuses connections from the internet |
| At rest, disk | **Done by the provider:** Render encrypts the database and its backups (AES-256) |
| At rest, per field | **Designed, not built:** encrypting names and emails would break search, sorting, and the one-user-per-email rule; decision 12 lists what doing it properly would take |
| Logs | **Done:** server logs hold no names, emails, or other personal data (security tests) |

## Trying to break THE search box (planned)

My questions, with what's already known and what's still to find out. The plan is to try each one in the real search box, and turn the findings into client tests (and API tests if the API needs a fix).

| Question | Known so far | To find out |
|---|---|---|
| Too much text | The box stops at 100 characters (also when pasting); past that, the API answers `400` | How a `400` shows in the page if the limit is bypassed |
| Empty or spaces | The page sends no search; the API refuses `search=` with `400` | — |
| SQL injection, `%` and `_` | Plain text on the API side (C1) | That the page sends them exactly as typed (one client test exists for SQL-looking text) |
| Script or HTML text | React shows it as text | That it's also safe in the "No users match" message |
| Emoji and accents | — | Whether `jose` finds `José` (the API ignores case, but likely not accents); whether an emoji counts as 1 or 2 of the 100 characters |
| Right-to-left text, zero-width and combining characters | — | How they display in the box and the "No users match" message |
| A NUL character (`\u0000`) | PostgreSQL text can't store it | **Whether the API answers `500` instead of a clear `400`: a possible real bug** |
| Newlines and tabs pasted | A single-line box usually drops newlines | What reaches the API |
| `&page=999` typed as text | Should be encoded and searched as plain text | That paging isn't affected |
| Recovery | — | That after a `400`, `429`, or `500`, the box still works and the next search clears the message |

**Origin:** mine (the questions and asking for this record); the AI wrote the answers and checked each "proven by" against the API's tests
