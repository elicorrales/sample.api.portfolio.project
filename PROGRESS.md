# Progress

**Last updated:** 2026-09-13

A quick "where are we" for resuming work. The full story is in [`project/docs/journal.md`](project/docs/journal.md), and the decisions are in [`project/docs/decisions/`](project/docs/decisions/README.md).

## Done

| Area | State |
|---|---|
| Design decisions | Logged in `project/docs/decisions/` (01–13) |
| Plain-language operations | `project/docs/spec/operations.md` (6 operations; was 16 before the "one user form, one save" revision) |
| OpenAPI spec | `project/api/openapi.yaml`: all 6 operations; phones and addresses are part of the user; passes lint; version 0.1.0 (1.0.0 once the web client proves it) |
| Docs page | Served by the API: Swagger UI at `/docs` (from `swagger-ui-dist`), the spec at `/openapi.yaml`; no token needed |
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
| **Bad-call tests** | **132 green** in `tests/bad-calls/` (body 64, query 18, ids 9, versions 8, conflicts 7, paths 12, settings 14). Unknown query params → 400; unknown path → 404; wrong method → 405 + `Allow`; unknown fields named. **132 tests total.** |
| **Security tests** | **78 green** in `tests/security/` (tokens 23, auth-first 12, injection 8, leaks 9, CORS 9, body size 2, public docs 10, demo token 5). Found and fixed 2 holes: tokens without `exp` were accepted; `X-Powered-By: Express` was sent. Also: auth now runs before the body is read; oversized body → `413`; `bearer` in any case. **192 tests total.** |
| **Rate-limit tests** | **12 green** in `tests/rate-limit/`. `shared/rate-limit.ts`: 100/min per IP, fixed window, before auth, after CORS; `trustProxy` option (default 0). Checked by hand with a `curl` loop. **204 tests total.** |
| **Database** | PostgreSQL via **Drizzle** on **PGlite** (decision 11). Tables `users`, `user_phones`, `user_addresses`; migration `api/migrations/0000_create_users.sql`. In-memory repository removed. **All 204 tests green on PostgreSQL**, one file at a time (`maxWorkers: 1`, ~50 s; parallel runs froze the laptop). `npm run dev` saves to `project/.data/`; checked in Swagger that data survives a restart. |
| **Integrity tests** | **24 green** in `tests/integrity/` (races 7, isolation 2, rollback 2, database rules 4, demo data 9). Races forced with `tests/helpers/racing-repository.ts`; mid-save failure via a temporary trigger. **Found 1 bug:** a same-email race got `500`, now `409` (`EmailTakenError`). Server logs included query values (names, emails): fixed in hosting step 2. **218 tests total.** |
| **Real PostgreSQL server** | Stage 3 done (decision 11): PGlite removed; `pg` driver; `embedded-postgres` runs PostgreSQL 18 from `node_modules` (no system install). Tests: one server per run (`tests/global-setup.ts`), one database per file copied from a migrated template. **218 green, no test changed, 65 s → 22 s.** `npm run dev` (`scripts/dev.ts`) starts PostgreSQL + API; checked in Swagger that data survives a restart. Hosted, the API only needs `DATABASE_URL`. |
| Test showcase | [`project/docs/testing.md`](project/docs/testing.md) (every category, most important first, with example cases) and a Tests section near the top of the README |
| VM symlinks | Enabled for the shared folder on the host (`SharedFoldersEnableSymlinksCreate`). Installs, tests, and servers run on the laptop (the VM is memory-limited). |
| Root README | Entry point for recruiters, employers, and devs: status, AI collaboration, reading order, run commands, links to my other work |

## Next steps

1. ~~Host the API on Render~~ **Done 2026-09-13: live at https://users-admin-api-98o8.onrender.com/docs.** All 8 hosting questions decided (journal row 37, decision 05), built in this order, each one red → green, then deployed:
   1. ~~Run on plain Node~~ **Done:** `erasableSyntaxOnly` on, 4 files' constructors rewritten, `npm start` = `node api/src/server.ts`, `dev` and `token` on plain `node` too, `tsx` removed, laptop Node 24.21.0 (pin it in `.nvmrc` and on Render at deploy). 218 green
   2. ~~Safe error logs~~ **Done:** logs only method, path, error name, PostgreSQL code, constraint, and the stack's `at` lines; 3 security tests (leaks D3a–c). **221 green**
   3. ~~Swagger in the API~~ **Done:** `/docs` (our page + an allowlist of 2 `swagger-ui-dist` files) and `/openapi.yaml`, no token; spec `servers: /`; Scarf install statistics off; `website/api-docs/` and `netlify.toml` deleted, `website/README.md` placeholder for the client. 10 security tests. **231 green**; tried in Swagger at `localhost:3000/docs`
   4. ~~Settings from env vars~~ **Done:** `shared/settings.ts` checks all 7 settings and refuses to start listing every problem; `JWT_SECRET` at least 32 characters; `TRUST_PROXY` now reaches the app; startup prints proxy hops, demo mode, user limit. 14 bad-call tests. **245 green**
   5. ~~200-user cap~~ **Done:** `MAX_USERS` → `409` `/problems/user-limit` (deleted users count; only creates are limited); count + insert in one transaction under advisory lock `USER_COUNT_LOCK`; 3 bad-call tests + race A7 (forced with a pausing trigger; **fails with the lock removed**). **249 green**
   6. ~~Demo token~~ **Done:** `POST /demo/token` (demo mode only, before auth): 1-hour admin token, `no-store`, fake-data note; `405` for other methods; shared `signAdminToken()` with `npm run token`; spec has a Demo tag. 5 security tests. **254 green**
   7. ~~Starting users, nightly reset, notice~~ **Done:** `api/src/demo/`: 50 starting users (5 deleted, all through create's validation), added on startup only to an empty database; reset at 08:00 UTC (`TRUNCATE` + insert in one transaction; no extra lock needed); notice at the top of `/docs` and in the token response; `npm run dev:demo`. 9 integrity tests. **263 green**; tried locally: 45 users, 3 pages
   8. ~~Deploy~~ **Done:** Render workspace `ancient-halls-server`, project `portfolio-api` (Production), Ohio. Postgres `users-api-db` (18, Basic-256mb, 1 GB, **outside access blocked**). Web service `users-admin-api` (Starter, root `project`, build `npm ci --omit=dev`, start `npm start`, health check `/docs`; **auto-deploy off**, I deploy by hand because I push often as a backup). Env: `DATABASE_URL` (internal + `?sslmode=no-verify`), `JWT_SECRET` (generated), `DEMO_MODE=true`, `MAX_USERS=200`, **`TRUST_PROXY=2`** (measured: `1` never blocked anyone), `CORS_ORIGINS=http://localhost:5173` (added for the client). Checked: `401` without a token, 45 users with a demo token, rate limit blocks the laptop, ignores a fake `X-Forwarded-For`, and doesn't block a phone on cell data
   - **Optional later:** rotate the database password (it was pasted into the AI chat; outside access is blocked, so it can't be used from the internet); startup log says `localhost:10000` on Render (cosmetic); spec intro still says "before any server code exists" (reword)
2. **Next: the admin web client** in `website/`, a single-page app hosted as a **Render static site** (changed from Netlify, decision 05; build filters matter less now that the API's auto-deploy is off); `CORS_ORIGINS` on Render already allows `http://localhost:5173`; add the client's address when it's deployed
   1. ~~5 look-and-feel mockups~~ **Done:** `website/public/mockups/` (deployed with the client at `/mockups/`; screenshots for the docs in `screenshots/`); **picked C, the engineering notebook** (checks as experiments, friendlier for non-technical visitors); decision 13. **Revised as C2** (`c2-notebook-spread.html`): the notebook lies open, list on the left page and the opened user on the right, so no scrolling; Experiments uses the same spread. **Big screens only** (about 1280 px or more; no phone layout)
   2. ~~Stack~~ **Done: Vite + React + TypeScript** (decision 13). Then set up the project, build, deploy; record the build and deploy steps in the journal as we go. The list call returns only id, names, email: the table shows those, and opening a user loads the rest
   3. ~~Set up the project~~ **Done (journal row 50, decision 13):** `website/` is the Vite project; 1 test (opens on "Users"), red then green; `npm run build` and `npm run dev` work. Mockups are at `/mockups/index.html` (`/mockups/` shows the app)
   4. **Now: the Users screen, test-first** (journal row 51). **Done:** types from the spec (`npm run api:types`), `openapi-fetch`, MSW; the list gets a demo token on open (memory only) and shows page 1; **5 client tests green** (unreachable, `401` token, `500` list, normal case, heading). Tests use `http://fake-api.test` and the client looks up `fetch` per call, so tests can't reach Render (checked by breaking it). **Seen live in the browser** (journal row 52): `npm run dev` shows the real 45 users from Render, unstyled. **Notebook look done** (row 53): `src/styles/notebook.css`, fonts from Fontsource; left page list, right page blank note; only working controls shown. **B, open a user: done** (row 54): right page, display only; shared in-memory token (`src/api/token.ts`), `src/api/call.ts`; **11 client tests green**. **The token on screen: done** (row 55, decision 13): Get demo token button, no-token page with reasons (unreachable, `429` countdown, API's words), corner countdown, expiry and refused pages; **17 client tests green**. **Next:** paging, search, open a user, save/`412`, delete/restore, create, `400` by field, `429` countdown, token countdown. Earlier picks:
      - **Types from the spec:** `openapi-typescript` (7.13.0) requires TypeScript 5, and we're on 7, so installing it would fail → run it with pinned `npx` (like Redocly), reading `../project/api/openapi.yaml`, and commit the generated file
      - **API calls:** `openapi-fetch` (0.17.0), typed by the generated file; no TanStack Query for now
      - **Tests, test-first:** Vitest + React Testing Library + MSW (a fake API inside tests, so they never hit Render or the rate limit). Client non-happy cases first: expired token → get a token again; `400` → message next to the named field; `412` → "someone saved first, reload"; `429` → countdown with buttons paused; API unreachable → clear message
      - Open question from the end of the session: the README link says "5 mockups"; optionally add "(decision 13)" to it
   5. Showcase panel ideas: demo token with countdown, no/forged token → `401`, rate-limit button (warn: blocks the visitor's IP up to 60 s), stale edit → `412`, same email twice → `409`, bad input / SQL in search, request inspector; each linked to its test
3. **Skipped on purpose; note in the README as next steps if the project continued:** performance tests; field-level encryption (decision 12); mutation testing (e.g. Stryker); request ids in logs and the other logging practices (decision 11)
4. Keep [`project/docs/testing.md`](project/docs/testing.md) and the README Tests table updated as each category grows.

## Useful commands (from `project/`)

| Command | Does |
|---|---|
| `npm test` | Run all tests once (~22 s; starts its own PostgreSQL server on port 54329) |
| `npm run test:bad-calls` | Only the bad-call tests |
| `npm run test:happy-path` | Only the happy-path and workflow tests |
| `npm run test:security` | Only the security tests |
| `npm run test:rate-limit` | Only the rate-limit tests |
| `npm run test:integrity` | Only the integrity tests |
| `npm run test:watch` | Re-run tests on file changes |
| `npm run typecheck` | TypeScript check |
| `npm run lint:spec` | Lint the OpenAPI spec |
| `npm start` | Start the API the way Render does (`node api/src/server.ts`); needs `JWT_SECRET` and `DATABASE_URL` set |
| `npm run dev:demo` | Like `dev`, in demo mode (`DEMO_MODE=true`, `MAX_USERS=200`), as on Render. Starting users are added only to an empty database |
| `npm run dev` | Start the API on port 3000 with plain `node --watch` (dev secret); docs at `http://localhost:3000/docs`. Also starts PostgreSQL on port 54320; data in `project/.data/postgres` survives restarts; delete that folder (with the server stopped) to start empty. |
| `npm run db:generate` | After changing `users.table.ts`: write the next SQL migration into `api/migrations/` (review it before running) |
| `npm run token` | Print an admin token (8 hours) to paste into Swagger UI's **Authorize** |

**Try the API in Swagger UI:** `npm run dev`; open `http://localhost:3000/docs`; click **Authorize** and paste the output of `npm run token`; then **Try it out**.

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
