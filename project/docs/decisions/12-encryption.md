# 12 — Encrypting user data

**Date:** 2026-09-13 · **Status:** Decided: **documented, not built**

## How it came up

Getting ready to host, I noticed we had never discussed encryption. The API stores personal data: names, emails, dates of birth, phone numbers, and home addresses. I decided to think it through and write it down here, but **not build any of it** in this project.

## The three layers

| Layer | Protects against | How | In this project |
|---|---|---|---|
| **In transit** | Someone reading traffic between the browser, the API, and the database | HTTPS to the API; SSL on the database connection | Comes with hosting: Render serves HTTPS automatically. The API reaches the database over Render's private network with SSL (`sslmode=no-verify`: encrypted, but the self-signed certificate isn't checked), and outside access to the database is off ([05](05-hosting.md#connecting-the-api-to-the-database-2026-09-13)). A setting, not code |
| **At rest, disk level** | A stolen disk, or a leaked backup file | The database provider encrypts the storage underneath PostgreSQL | Left to the provider. **Verified:** Render Postgres encrypts data and backups with AES-256 (chosen in [05](05-hosting.md#database-provider-and-plans-2026-09-13)) |
| **At rest, field level** | Someone who gets into the database itself, or a copy of its data | The API encrypts chosen fields (e.g. AES-256-GCM) before saving, and decrypts them after loading | **Not done.** Reasons below |

## Why field-level encryption isn't done

It isn't free. Each field has a cost:

| Field | What encrypting it would break or require |
|---|---|
| First and last name | **Search stops working:** `ILIKE '%ann%'` can't match encrypted text. **Sorting stops working** too |
| Email | Same, plus the **unique index on `lower(email)`** stops working. Keeping "one user per email" would need a **blind index**: an extra column holding a keyed hash (HMAC) of the lowercased email, with the unique index on that instead |
| Date of birth | Feasible: never searched or sorted. The 18-or-older rule is checked in code before saving |
| Phones, addresses | Feasible: never searched. The database rules (one per type, one primary) use the `type` and `is_primary` columns, which could stay unencrypted |

And the key has to live somewhere:

| Where the key lives | What it protects |
|---|---|
| A Render environment variable, next to `DATABASE_URL` | A leaked database dump or backup is unreadable. But anyone who gets into the API's environment gets the key and the database address together |
| A key management service (AWS KMS, Google Cloud KMS, HashiCorp Vault) | Stronger: the key never sits in the app's settings, access is logged, keys can be rotated. Adds a service, cost, and setup |

**Options considered:**

| Option | Result |
|---|---|
| **A. In transit + the provider's at-rest encryption, documented** | Standard for an app like this. **Chosen** |
| B. A, plus encrypting only the unsearched fields (date of birth, phones, addresses) | Shows the technique; search keeps working; adds key handling, migrations, and tests |
| C. Encrypt everything, with a blind index for email | Search and sort by name are lost; too costly for what it protects here |

**Choice:** A, written up here, with nothing built. **Origin:** mine (raised it, and chose to document rather than build); options suggested

## If this project continued

What doing it properly would take, in order:

1. **Confirm the basics when hosting:** HTTPS only, `sslmode=require` on `DATABASE_URL`, and the provider's at-rest encryption checked in their documentation
2. **Keep personal data out of logs** (already an open item, [11](11-database.md#found-along-the-way-personal-data-in-server-logs-open)). Logs are often the easiest place to leak data from
3. **Encrypt the unsearched fields** (option B): date of birth, phone numbers, and street, city, and ZIP, with AES-256-GCM and a fresh random IV per value, stored as `bytea`. Only the repository would change; the service and API wouldn't know
4. **Key handling:** a key version stored with each value, so keys can be rotated without re-encrypting everything at once
5. **If name or email had to be encrypted:** a blind index for exact email matches and uniqueness, and accept that partial search on names goes away
6. **Tests to add:** the raw database row never contains the plain value; a wrong key fails loudly; key rotation reads both old and new values

## What protects the data today

Even without encryption, several things already limit who can reach the data:

| Protection | Where |
|---|---|
| Every request needs a signed admin token with an expiry | [04](04-admin-vs-self-service.md), security tests |
| Rate limiting before auth | [10](10-api-conventions.md), rate-limit tests |
| Errors never include SQL, stack traces, or file paths | Security tests (data leaks) |
| Every value goes into SQL as a parameter, never pasted in | Security tests (injection) |
| The public demo holds fake data only, with a notice and a scheduled reset | [05](05-hosting.md) (to build when hosting) |
