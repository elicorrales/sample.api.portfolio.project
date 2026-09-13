# Progress

**Last updated:** 2026-09-13

A quick "where are we" for resuming work. The full story is in [`project/docs/journal.md`](project/docs/journal.md), and the decisions are in [`project/docs/decisions/`](project/docs/decisions/README.md).

## Done

| Area | State |
|---|---|
| Design decisions | Logged in `project/docs/decisions/` (01–11) |
| Plain-language operations | `project/docs/spec/operations.md` (6 operations; was 16 before the "one user form, one save" revision) |
| OpenAPI spec | `project/api/openapi.yaml`: all 6 operations; phones and addresses are part of the user; passes lint; version 0.1.0 (1.0.0 once the web client proves it) |
| Docs page | `website/api-docs/index.html` (Swagger UI) |
| License | MIT, `LICENSE` |
| Test setup files | `project/package.json`, `tsconfig.json`, `vitest.config.ts`, `.nvmrc`, `.npmrc` |
| Code layout | Decision 06 decided: feature folders, layer in the filename (`users.routes.ts` → `users.service.ts` → `users.repository.ts`) |
| **Vertical slice: create user** | `POST /v1/users` works end to end: Zod validation, rules, in-memory repository, JWT auth, CORS, Problem Details errors. The other 5 operations answer `501`. Tried live from Swagger UI: `201`, then `409` on the same email. |
| **List users** | `GET /v1/users`: search, sort (ignoring case; tie-breakers always ascending), paging, page past the end → empty page. Tried from Swagger UI. |
| **Get one user** | `GET /v1/users/{userId}`: basic (default) or `view=detailed`, `ETag`; unknown id → `404`. Express's automatic ETags turned off. |
| **Update user** | `PUT /v1/users/{userId}` with `If-Match`: whole-user replace, version bump, same email allowed; `412` stale, `428` missing. Tried from Swagger UI. |
| **Delete user** | `DELETE /v1/users/{userId}` with `If-Match` → `204`; sets `deletedAt`, bumps version; hidden unless `includeDeleted=true` (list and get); update of a deleted user → `404`. Tried from Swagger UI. |
| **Restore user** | `POST /v1/users/{userId}/restore` (no `If-Match`) → `200`, version bump; `409` if not deleted. **All 6 operations now work** (in-memory storage). Tried from Swagger UI. |
| Happy-path tests | **17 green, happy path complete:** `tests/happy-path/` (16: create 2, list 5, get 2, update 2, delete 3, restore 2) and `tests/workflow/admin-session.test.ts` (1: one admin session, ETags passed step to step). Helper `tests/helpers/users.ts` (`createUser`, `userInput`) |
| **Bad-call tests** | **115 green** in `tests/bad-calls/` (body 64, query 18, ids 9, versions 8, conflicts 4, paths 12). Unknown query params → 400; unknown path → 404; wrong method → 405 + `Allow`; unknown fields named. **132 tests total.** |
| **Security tests** | **60 green** in `tests/security/` (tokens 23, auth-first 12, injection 8, leaks 6, CORS 9, body size 2). Found and fixed 2 holes: tokens without `exp` were accepted; `X-Powered-By: Express` was sent. Also: auth now runs before the body is read; oversized body → `413`; `bearer` in any case. **192 tests total.** |
| **Rate-limit tests** | **12 green** in `tests/rate-limit/`. `shared/rate-limit.ts`: 100/min per IP, fixed window, before auth, after CORS; `trustProxy` option (default 0). Checked by hand with a `curl` loop. **204 tests total.** |
| **Database** | PostgreSQL via **Drizzle** on **PGlite** (decision 11). Tables `users`, `user_phones`, `user_addresses`; migration `api/migrations/0000_create_users.sql`. In-memory repository removed. **All 204 tests green on PostgreSQL**, one file at a time (`maxWorkers: 1`, ~50 s; parallel runs froze the laptop). `npm run dev` saves to `project/.data/`; checked in Swagger that data survives a restart. |
| **Integrity tests** | **14 green** in `tests/integrity/` (races 6, isolation 2, rollback 2, database rules 4). Races forced with `tests/helpers/racing-repository.ts`; mid-save failure via a temporary trigger. **Found 1 bug:** a same-email race got `500`, now `409` (`EmailTakenError`). **Open:** server logs include query values (names, emails); decide before hosting (decision 11). **218 tests total**, ~65 s. |
| Test showcase | [`project/docs/testing.md`](project/docs/testing.md) (every category, most important first, with example cases) and a Tests section near the top of the README |
| VM symlinks | Enabled for the shared folder on the host (`SharedFoldersEnableSymlinksCreate`). Installs, tests, and servers run on the laptop (the VM is memory-limited). |
| Root README | Entry point for recruiters, employers, and devs: status, AI collaboration, reading order, run commands, links to my other work |

## Next steps

1. **Next: pick one** (not yet chosen):
   - **Native PostgreSQL** (stage 3): truly simultaneous connections for the integrity tests
   - **Hosting:** docs page on Netlify, API on Render. Needs:
     - a hosted PostgreSQL (Render, Neon, or Supabase; their free tiers expire or sleep)
     - a way for visitors to get a token (decision 05)
     - `trustProxy` set for Render (decision 10, row 27)
     - **personal data kept out of server logs** (decision 11, open)
   - **Performance tests:** the last test category; needs a load-testing tool (k6 or autocannon)
2. Keep [`project/docs/testing.md`](project/docs/testing.md) and the README Tests table updated as each category grows.
3. **Maybe later:** mutation testing (e.g. Stryker) to check the tests catch deliberately broken code; speeding up the suite (each file spends ~2 s starting PGlite)
4. **Later:** admin web client
5. **Once the docs page is on Netlify:** add this API to the [projects landing page](https://all-my-projects-landing-page.netlify.app/), and add the live docs link to `README.md` (it has local-only instructions for now)

## Useful commands (from `project/`)

| Command | Does |
|---|---|
| `npm test` | Run all tests once (~65 s, one file at a time) |
| `npm run test:bad-calls` | Only the bad-call tests |
| `npm run test:happy-path` | Only the happy-path and workflow tests |
| `npm run test:security` | Only the security tests |
| `npm run test:rate-limit` | Only the rate-limit tests |
| `npm run test:integrity` | Only the integrity tests |
| `npm run test:watch` | Re-run tests on file changes |
| `npm run typecheck` | TypeScript check |
| `npm run lint:spec` | Lint the OpenAPI spec |
| `npm run dev` | Start the API on port 3000 (dev secret; allows the docs page on 8080 via CORS). Data is saved in `project/.data/` and survives restarts; delete that folder to start empty. |
| `npm run db:generate` | After changing `users.table.ts`: write the next SQL migration into `api/migrations/` (review it before running) |
| `npm run token` | Print an admin token (8 hours) to paste into Swagger UI's **Authorize** |

**Try the API in Swagger UI:** `npm run dev` in one terminal; `python3 -m http.server 8080` from the repo root in another; open `http://localhost:8080/website/api-docs/`; click **Authorize** and paste the output of `npm run token`; then **Try it out**.

## Working agreements

- I stay involved in each step: propose and explain briefly, then I decide
- Short answers (tables and bullets)
- Log decisions in `project/docs/decisions/` and a journal row after each step, with origin tags (mine / picked / suggested / changed)
- Everything installed local to the repo; no global packages
- I commit and push myself
- **How each step goes:** walk through the test list and open questions first → the AI writes the tests and **predicts** which fail and why → I run them on my laptop (red) → the AI changes the code → I run them (green) and try it in Swagger UI → the AI updates decisions, a journal row, PROGRESS, README, and the test showcase → I commit
- **Laptop, not VM:** installs, test runs, and servers run on my laptop; the AI's VM is memory-limited (it writes code, typechecks, and lints)
- **Laptop memory is tight too:** 7.5 GB, ~3.4 GB free with the VM running. Keep test runs at one file at a time; anything that starts several databases at once needs its memory estimated first
- **Showcase what the API refuses:** the non-happy-path test categories get top billing in the README and `project/docs/testing.md`
- **Swagger UI can't see every header:** browser code only reads headers the API exposes through CORS. To check headers like `WWW-Authenticate`, use `curl -i`.
