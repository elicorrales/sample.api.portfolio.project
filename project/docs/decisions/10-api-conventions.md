# 10 — API conventions (mapping operations to HTTP)

**Date:** 2026-09-12 · **Status:** Decided

## Context

Before writing the OpenAPI file, the AI walked me through how the [plain-language operations](../spec/operations.md) map to HTTP: paths, methods, status codes, and where inputs go. Before accepting, I asked three questions about the proposals:

1. How do they hold up against intrusion and hacking?
2. Is the "official standard" error format really not JSON? (see [Pushback](#pushback-problem-details-is-json))
3. How does each choice affect the future web client?

## Where inputs go

| Location | Used for | Example |
|---|---|---|
| Path | Which record | `/users/{userId}/phones/{phoneId}` |
| Query string | Filtering and options | `?search=smi&sort=lastName` |
| Body (JSON) | The record's fields | `{ "firstName": "Ann", ... }` |
| Header | Auth token, version check | `Authorization`, `If-Match` |

## Operations

| # | Operation | Method | Path |
|---|---|---|---|
| 1 | Create user | POST | `/v1/users` |
| 2 | List users | GET | `/v1/users?search=&sort=&order=&page=&pageSize=&includeDeleted=` |
| 3 | Get user | GET | `/v1/users/{userId}?view=basic\|detailed&includeDeleted=` |
| 4 | Update user | PUT | `/v1/users/{userId}` |
| 5 | Delete user | DELETE | `/v1/users/{userId}` |
| 6 | Restore user | POST | `/v1/users/{userId}/restore` |
| 7–11 | Phones | POST, GET, GET, PUT, DELETE | `/v1/users/{userId}/phones[/{phoneId}]` |
| 12–16 | Addresses | POST, GET, GET, PUT, DELETE | `/v1/users/{userId}/addresses[/{addressId}]` |

**Restore uses POST** because it's an action, not a field change.

## Status codes

| Result | Code |
|---|---|
| Created | `201`, plus a `Location` header pointing to the new record |
| Read or updated | `200` |
| Deleted | `204` (no body) |
| Invalid input | `400` |
| Not signed in | `401` |
| Not allowed | `403` |
| Not found / hidden | `404` |
| Uniqueness conflict; restoring a user who isn't deleted | `409` |
| Version out of date | `412` |
| Version missing | `428` |
| Too many requests | `429` |

## Decisions

| # | Question | Options | Choice | Why | Origin |
|---|---|---|---|---|---|
| 1 | ID format | Numbers, or UUIDs | **UUID** | Can't be guessed or counted | suggested |
| 2 | How the version is sent | `version` field in the body, or `ETag` / `If-Match` headers | **`If-Match` header**; responses also include `version` | The HTTP standard; works for DELETE, which has no body | suggested |
| 3 | Error format | Our own JSON shape, or the standard Problem Details JSON shape (RFC 9457) | **Problem Details** | Standard fields, plus an `errors` list for field messages | suggested (framing corrected by me; see below) |
| 4 | Invalid input code | `400` for all, or `400` + `422` | **`400` for all** | Simpler; the error body says what's wrong | suggested |
| 5 | Paging style | Page + page size, or cursor | **Page + page size** | Supports "Page 3 of 12" in the web client | suggested |
| 6 | Field naming | `firstName` or `first_name` | **`firstName`** | JavaScript convention | suggested |
| 7 | Version prefix | `/v1/users` or `/users` | **`/v1`** | Room for breaking changes later | suggested |
| 8 | Deleting a phone or address requires the version? | Yes or no | **No** | Permanent and cheap to redo; matches the operations list | suggested |

## Pushback: Problem Details is JSON

The AI's first table offered "custom JSON **vs** Problem Details," which implied the standard format isn't JSON. I questioned that.

**Correction:** Problem Details *is* JSON (media type `application/problem+json`). The real choice was **our own JSON shape vs a standard JSON shape.** The choice didn't change; the reasoning behind it became accurate.

```json
{
  "type": "https://example.com/problems/validation",
  "title": "Invalid input",
  "status": 400,
  "detail": "2 fields are invalid",
  "errors": [
    { "field": "email", "message": "Must be a valid email" },
    { "field": "dateOfBirth", "message": "Must be 18 or older" }
  ]
}
```

**Origin:** mine (the pushback)

## Security review of the choices

Prompted by my question about intrusion and hacking.

| # | Choice | Security effect |
|---|---|---|
| 1 | UUID | Helps: IDs can't be guessed or counted. Doesn't replace permission checks. |
| 2 | If-Match | None; it prevents lost updates, not attacks |
| 3 | Problem Details | Risk: error text could leak internals |
| 4 | `400` for all | Neutral; messages must not echo raw input back, which the web client could display unsafely |
| 5 | Page + page size | Risk: huge page sizes or deep pages cause slow queries |
| 6 | camelCase | None |
| 7 | `/v1` | Minor: old versions left running add attack surface |
| 8 | No version on delete | None |

## Web client review of the choices

Prompted by my question about the future web client.

| # | Choice | Web client effect |
|---|---|---|
| 1 | UUID | Long URLs; IDs can't be typed by hand |
| 2 | If-Match | Client sends back the version it loaded. The client (Netlify) and API (Render) are on different domains, so the browser hides `ETag` unless the API exposes it. On `412`, show "changed, reload". |
| 3 | Problem Details | One error handler; the `errors` list maps directly to form-field messages |
| 4 | `400` for all | Client reads the error body, not the code |
| 5 | Page + page size | "Page 3 of 12"; pages can shift if records change meanwhile |
| 6 | camelCase | JSON used as-is in JavaScript |
| 7 | `/v1` | Part of the base URL setting |
| 8 | No version on delete | "Are you sure?" dialog instead |

The `Authorization` and `If-Match` headers trigger a browser CORS preflight, so the API must allow them.

## Shared components (spec piece 1)

Reusable parts that every endpoint references: the admin token scheme, the Problem error schema, paging, ID parameters, the `If-Match` / `ETag` version header, and the standard error responses.

| # | Question | Options | Choice | Why | Origin |
|---|---|---|---|---|---|
| 9 | Default page size | 10, 20, 50 | **20** | Common middle ground | suggested |
| 10 | List response shape | Wrapper `{ items, page, pageSize, totalItems, totalPages }`, or a bare array with paging info in headers | **Wrapper** | Easy for the web client; avoids the cross-domain header problem | suggested |
| 11 | Rate-limit info | `Retry-After` on `429` only, or also `RateLimit-*` headers | **`Retry-After` only** | Finished standard; `RateLimit-*` was still a draft | suggested |
| 12 | Problem `type` values | `about:blank`, or our own paths like `/problems/validation` | **Our own paths** | More specific; can become explanation pages on the portfolio site | suggested |

A spec linter run after piece 1 flagged two more questions:

| # | Question | Options | Choice | Why | Origin |
|---|---|---|---|---|---|
| 13 | Server list | None, or `http://localhost:3000` now plus the Render URL later | **`localhost:3000`, Render later** | Without it, Swagger UI's "Try it out" sends requests to the docs page's own address; 3000 is the usual Express port | suggested |
| 14 | License | MIT, all rights reserved, or none | **MIT** | Common for portfolio code; others may reuse it with credit. `LICENSE` file at the repo root, copyright Eli Corrales. | mine |
| 15 | Lint the spec as a standing step | Yes or no | **Yes**, after every spec change and later in CI | Cheap quality check employers recognize | suggested |

Lint command (pinned version): `npx @redocly/cli@2.52.1 lint project/api/openapi.yaml`. The remaining warnings are expected: unused components until endpoints exist, and a note that the server is `localhost`.

Also included, as standards rather than choices:

- `401` responses send `WWW-Authenticate: Bearer`
- Timestamps are UTC ISO 8601
- Date of birth is date-only, to avoid timezone off-by-one-day bugs

## Additions from those reviews

**Origin:** suggested (prompted by my security and web client questions)

| Rule | Why |
|---|---|
| Maximum page size of 100 | Prevents slow-query abuse |
| Sort field must come from an allowed list | Sort values are often inserted into SQL, a classic injection hole |
| Check auth before checking whether a record exists | Otherwise `404` vs `401` reveals which IDs exist |
| Error messages never include stack traces, SQL, or file paths | Prevents leaking internals |
| API exposes `ETag` and allows `Authorization` / `If-Match` via CORS | The web client on another domain can use them |
