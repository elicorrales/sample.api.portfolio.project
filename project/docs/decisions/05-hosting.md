# 05 — Hosting and public demo

**Date:** 2026-09-12 · **Status:** Partly decided

## Choice

Start local, then host on services I already use.

**Origin:** mine (I already host game servers on Render and front-end clients on Netlify)

| Piece | Host | Notes |
|---|---|---|
| API (Express) | Render web service | Same kind of deploy as my game servers |
| Swagger UI | Served by the API at `/docs` | Docs and API share one URL, so no CORS setup |
| PostgreSQL | Render Postgres | Or Neon/Supabase if Render's free tier doesn't fit |
| Portfolio pages | Netlify | `website/` |
| Web client (later) | Netlify | Needs CORS enabled on the API |

### Revised at hosting time (2026-09-13)

| Piece | Before | Now | Why |
|---|---|---|---|
| Swagger UI | Static page on Netlify, then `/docs` | **Served by the API at `/docs` on Render** | One URL, "Try it out" works, no CORS for the docs |
| Portfolio pages (journal, decisions, test showcase) | Netlify (`website/`) | **GitHub**, with the README as the entry point | GitHub already renders the markdown; nothing extra to host |

**Origin:** mine

### Swagger served by the API; Netlify kept for the web client (2026-09-13)

| Path | Serves | Token? |
|---|---|---|
| `/docs` | Swagger UI, from the pinned **`swagger-ui-dist`** npm package | No |
| `/openapi.yaml` | The one spec file | No |
| `/v1/...` | The API | Yes |

- The spec's `servers` becomes **`/`**, so "Try it out" calls whichever address served the page (laptop or Render), with no CORS
- `/docs` goes through the rate limit like everything else
- Tests: `/docs` and `/openapi.yaml` answer `200` without a token, and `/v1/users` still answers `401`
- Locally: `npm run dev`, then `http://localhost:3000/docs`. No second server
- **`website/api-docs/` and `netlify.toml` are deleted.** No Netlify site was ever live for this repo. **`website/` itself stays, for the web client**

**The AI first proposed dropping Netlify altogether. I disagreed:** Swagger is for technical visitors, not a website. Netlify is where the **admin web client** goes: a simple, professional CRUD page, the kind a company builds for an internal tool. That was already the plan in the table above. **I also asked why a `netlify.toml` is needed at all,** since I deploy my other clients by uploading a zip. It isn't: the file only matters when Netlify builds from the Git repo. How to deploy the client is decided at the client step.

**A misunderstanding from day one:** I created the empty `website/` folder **for the web client**. The AI read it as "portfolio pages about how it was built" (see the first table above) and later put the Swagger page in it. Corrected: `website/` holds the admin web client, and the "how it was built" story lives on GitHub (README, journal, decisions).

**Origin:** mine (Netlify and `website/` for the client)

**As built:**

- **Only 2 package files are served** (`swagger-ui.css`, `swagger-ui-bundle.js`), not the whole `swagger-ui-dist` folder. A check before running the tests showed the folder also served Swagger's sample Petstore `index.html`. **Origin:** suggested
- **Scarf turned off** (`"scarfSettings": { "enabled": false }`). Installing `swagger-ui-dist` added a second package, `@scarf/scarf`, which reports install statistics on every `npm install`, Render's included. **Origin:** suggested; I agreed
- The path-trick tests send requests **raw**: supertest resolves `..` before sending, so they would have tested nothing
- `website/README.md` is a placeholder for the web client, since git doesn't keep empty folders
- 10 security tests; 231 green; tried in Swagger at `localhost:3000/docs`; the `/docs` details were suggested and I agreed

### Database provider and plans (2026-09-13)

**Question:** Which hosted PostgreSQL 18, and free or paid?

**Free plans first** (checked 2026-09-13):

| | Render Postgres | Neon | Supabase |
|---|---|---|---|
| Expires? | **Deleted 30 days after creation** (+14-day grace) | No | No, but **paused after 1 week idle** |
| PostgreSQL 18 | Yes | Preview | No |
| Idle behavior | Always on | Sleeps after 5 min, wakes in under a second | Paused until restarted by hand |

The AI's pick was **Neon**: a portfolio link has to keep working for months. My games already run on paid Render instances in the same workspace, so **I said paid was fine**, which changed the comparison:

| | Render Postgres Basic-256mb | Neon (free) | Neon Launch | Supabase Pro |
|---|---|---|---|---|
| Cost/month | $6 + $0.30/GB | $0 | Pay per use | $25 |
| PostgreSQL 18 | **Stable** (same as the tests) | Preview | Preview | No |
| Restore to an earlier point | 3 days, plus 7-day backups | 6 hours | 7 days | Yes |
| Path from the API | **Render's private network** | Public internet (SSL) | Public internet (SSL) | Public internet (SSL) |

**Choice:**

| Piece | Plan | Cost/month |
|---|---|---|
| API | Render **Starter** web service (never sleeps) | $7 |
| Database | Render Postgres **Basic-256mb**, PostgreSQL 18 | $6 + storage |
| Where | A new **project** in my existing Render workspace | — |

**Why:**

- Same PostgreSQL version as the tests, and not a preview
- The database can refuse outside traffic; only the API reaches it, over Render's private network
- Neither the API nor the database sleeps, so no ~1-minute wait on a first visit
- One dashboard and one bill
- Same workspace is fine: paid services don't use the 750 free hours, and a paid database isn't limited to one per workspace
- Encrypted at rest (AES-256, backups included), which settles that row of [12](12-encryption.md)

**Origin:** picked (the AI's pick changed from Neon once I said paid was fine)

### Connecting the API to the database (2026-09-13)

| Option | Encrypted | Certificate checked | Tradeoff |
|---|---|---|---|
| A. Internal URL, no SSL | No | No | Traffic stays on Render's private network |
| **B. Internal URL + `?sslmode=no-verify`** | **Yes** | No: Render's internal certificate is self-signed | A setting in `DATABASE_URL`; no code change |
| C. External URL, full SSL | Yes | Yes | Leaves Render's network; the database stays open to the internet |

**Choice:** B, with the database's **external access turned off**, so only Render services in the same region can connect.

**Why:** Encrypted at no cost, and nothing outside Render can even try the password. The unchecked certificate is an accepted limit on a private network.

**Question I asked:** why worry about migrations if the project won't change after it's done? The hosted database starts empty, so the one migration has to run once to create the tables. It needs no setup: the API applies any missing migrations each time it starts (`api/src/shared/database.ts`), from inside Render. (The AI had first said this needed planning, before checking the code.)

**HTTPS** to the API: automatic on Render, with HTTP redirected to HTTPS.

**Origin:** picked

### How the API runs on Render (2026-09-13)

| Option | Start command | Tradeoff |
|---|---|---|
| A. `tsx` in production | `tsx api/src/server.ts` | A dev tool in production; converts the code on every start |
| B. Compile first | `tsc`, then `node dist/server.js` | Build config, a `dist/` folder, and the migrations and spec re-pathed |
| **C. Node runs the TypeScript itself** | `node api/src/server.ts` | No build step, no extra tool; 2 small code changes |

**Choice:** C. Node 24 strips type annotations and runs `.ts` files directly (stable since 24.12). The code already uses `.ts` import extensions and `verbatimModuleSyntax`. Two constructors use parameter properties (`constructor(private readonly repository: …)`), which Node can't strip; they become ordinary fields. `erasableSyntaxOnly` in `tsconfig.json` makes `npm run typecheck` catch that pattern if it returns. Node doesn't type-check, but `npm run typecheck` and the tests do.

**Origin:** picked

**As built:** turning on `erasableSyntaxOnly` first and letting the typechecker list the problems found **4 files, not the 2 the AI had counted** (it missed `ProblemError` and a test helper). **I asked that local runs match Render as closely as possible,** so `npm run dev` and `npm run token` also run on plain `node` (`node --watch` for auto-restart), and `tsx` was removed. My laptop's Node was 24.4.1, older than the 24.12 that made this stable; updated with `nvm install 24` to **24.21.0**, which Render will be pinned to as well. 218 green; in Swagger, a user created on a fresh database.

### Settings checked at startup (2026-09-13)

All settings come from environment variables, read and checked in one place (`shared/settings.ts`):

| Variable | Rule | Unset means |
|---|---|---|
| `JWT_SECRET` | Required; **at least 32 characters** (HS256 wants 256 bits) | Won't start |
| `DATABASE_URL` | Required | Won't start |
| `PORT` | Whole number | 3000 (Render sets it) |
| `CORS_ORIGINS` | Comma-separated list | None |
| `TRUST_PROXY` | Whole number, 0 or more | 0 |
| `DEMO_MODE` | Exactly `true` or `false` | Off |
| `MAX_USERS` | Whole number, 1 or more | No limit |

**Strict on purpose:** `TRUST_PROXY=one` or `DEMO_MODE=yes` stops the deploy with every problem listed at once, instead of running quietly with a default. Secrets are never echoed in the message, since it lands in the host's logs. The 32-character minimum is new; the dev secret is 38. `DEMO_MODE` and `MAX_USERS` were added now, though later steps use them, so the settings are decided and tested once. On startup the server prints proxy hops, demo mode, and the user limit, to confirm a deploy's settings at a glance.

**Origin:** suggested; I agreed (including adding the later settings now)

## Viewing the spec before the API exists

**Question:** How do I (and employers) see the OpenAPI spec while it's being written?

| Option | Employers can see it? | "Try it out" works? |
|---|---|---|
| Swagger Editor (editor.swagger.io) | No, private scratch | No |
| **Static Swagger UI page** | Yes, on Netlify | Not until the API exists |
| Redoc (read-only docs) | Yes | No |
| Mock server (e.g. Prism) | If hosted | Yes, with fake data |
| API serves `/docs` itself | Yes | Yes (final setup) |

**Choice:** a static Swagger UI page, published before any server code exists.

**Why:** It shows design-first in action ("here's the contract, before the code"). Later it can point at the live API. **Origin:** suggested

**Where it lives:**

| Option | Tradeoff |
|---|---|
| A. `project/api/docs/`, as its own Netlify site | Separate from the portfolio site |
| B. `website/api-docs/`, with a committed copy of the spec | Two copies could drift |
| **C. `website/api-docs/`; Netlify builds from the repo root and copies the one spec in at build time** | One spec file, one site |

**Choice:** C. **Origin:** picked

**How it works:**

- `project/api/openapi.yaml` is the only real spec file
- `website/api-docs/index.html` loads the spec from `/project/api/openapi.yaml`, the same path everywhere
- **Locally:** serve the repo root and open `/website/api-docs/`; the real file is already at that path, so there's nothing to copy
- **Netlify:** it only publishes `website/`, so `netlify.toml` copies the spec to `website/project/api/openapi.yaml` during each deploy
- That deploy copy is in `.gitignore`, so it's never committed and can't drift

**Pushback:** the first version had the page read a copy placed next to it, which meant copying the spec by hand before every local view. I rejected that. Now the page uses one path that works both locally and on Netlify, so only Netlify copies. **Origin:** mine (the pushback)

## Local vs hosted

| | Local | Hosted |
|---|---|---|
| API | `npm run dev` | Render |
| DB | Postgres in Docker | Render Postgres |
| Config | `.env` | Render environment variables |

Use the same variable names (`DATABASE_URL`, `JWT_SECRET`) everywhere, so the code doesn't change between environments.

## Free-tier cautions

Check Render's current terms; these change.

- Free web services sleep when idle. The first request can take close to a minute, which is a bad first impression for an employer.
- Free Postgres databases have expired after a set number of days.

## Open question: how do demo visitors use an admin API?

| Option | How it works |
|---|---|
| Demo token endpoint | `POST /demo/token` returns a short-lived admin token to paste into Swagger's "Authorize" |
| Demo token shown in the docs | Simpler, but anyone can copy and reuse it |

**Required either way:**

- Rate limiting
- Scheduled reset back to seed data
- A separate demo database with no real data

These demo safeguards double as security and rate-limit tests ([03](03-test-strategy.md)).

### Decided at hosting time (2026-09-13)

| Option | Visitor steps | Result |
|---|---|---|
| **A. Demo token endpoint** | Call it with **Try it out**, copy the token, paste it into **Authorize** | **Chosen** |
| B. Fixed token written on the page | Copy and paste | Out: it would need a token with no expiry, a hole the security tests closed |
| C. `/docs` pre-fills a fresh token | None | Easiest, but hides how auth works |

**Limits:**

- The token lasts **1 hour**
- The endpoint exists **only when `DEMO_MODE` is on** (set on Render, off by default)
- It counts against the rate limit like any other call
- In demo mode, anyone can act as an admin. That's acceptable only because the data is fake and gets reset

**Why:** It's the same steps I followed with `npm run token` while building. **And I pointed out a bonus:** visitors who skip the token can watch every call get refused with `401`, so the auth shows itself.

**Origin:** picked (the bonus is mine)

**As built:** `POST /demo/token`, outside `/v1`, mounted before auth and only in demo mode; with demo mode off it answers `401` like any unknown path. Response: `{ token, tokenType: "Bearer", expiresIn: 3600, note }` with `Cache-Control: no-store`. The token is signed by the same `signAdminToken()` as `npm run token`. In the spec it has its own **Demo** tag at the top, with no lock icon. **I asked for the plan in simpler words first,** then recognized it as this question's option A. **I also asked whether `no-store` is real protection,** since a browser can ignore it: it isn't a lock, only a request that well-behaved caches (browser disk, company proxy, CDN) obey, so they don't keep a copy to hand to someone else. The 1-hour expiry and HTTPS are the real protection; OAuth requires the header on token responses anyway. 5 security tests; 254 green.

### Demo data: 50 starting users and a 200-user cap (2026-09-13)

**I asked for both:** create a batch of users on first startup, so the web client has at least 2 pages to show, and cap the total at 200.

**Starting users:**

| Question | Choice | Why |
|---|---|---|
| How many | **50** | 3 pages at the default page size of 20 |
| When | On startup, **only if the `users` table has no rows at all** (deleted rows count) | If visitors delete everyone, there's no surprise reseed; the scheduled reset handles that |
| In tests | **Never:** seeding runs from `server.ts`, not `createApp()` | Tests start empty and create their own users |
| Data source | A hand-written list in the repo, picked in a fixed order | No new library; the same 50 users every time; must pass the API's own rules (A–Z names, 18+, valid phones and addresses) |
| Emails | `@example.com` | Reserved for examples; no real inbox |
| Variety | 0–3 phones and addresses, a few name ties, a few already deleted | Search, sort tie-breakers, and `includeDeleted` are all worth trying |

**Cap:**

| Question | Choice | Why |
|---|---|---|
| Limit | **200 users, deleted rows included** | Deleted users still take space. The rate limit alone allows ~144,000 creates a day |
| When full | **`409`**, type `/problems/user-limit` | The request is valid; the current state blocks it. `429` means too fast, and `507` belongs to WebDAV |
| Setting | `MAX_USERS` env var; unset means no limit | Same pattern as `TRUST_PROXY`; tests use a small number |
| Race at user 199 | A PostgreSQL advisory lock around the count and the insert | Otherwise two creates could both pass the check and make 201 |
| Tests | Bad call (full → `409`) and integrity (the race, with the racing repository) | Another refusal and another race, for the showcase |
| Spec | The new `409` on create user, in `openapi.yaml` and `operations.md` | Spec first |

**Origin:** mine (50 users, the 200 cap); the details were suggested and I agreed

**Cap as built:** only creates are limited; update, delete, and restore add no rows. Checks on create: body `400` → email `409` → limit `409`. The repository counts and inserts in one transaction holding advisory lock `USER_COUNT_LOCK` (the nightly reset will take the same lock). The race test couldn't use the racing repository, since the count is inside the insert; a temporary trigger pauses each insert for 0.3 s instead. **I checked the race test by breaking the code:** with the lock line commented out, it failed (`201, 201`, 4 users); restored, it passed. 249 green.

### Keeping the demo healthy without me: a nightly reset (2026-09-13)

**Goal (mine):** the hosted demo must never need me to fix it.

**How we got there:**

| Round | Proposal | My answer |
|---|---|---|
| 1 | AI: wipe daily, back to the 50 starting users | **No**, I hadn't planned on wiping users |
| 2 | At 200: A. refuse; B. start over on the next create; C. permanently remove the oldest deleted users, then refuse | **C is best**, but "demo is full" can still happen if someone floods the API on purpose, and something has to handle that |
| 3 | AI: after deleted users, remove the oldest visitor-created user, never the 50 starting users (a new "starting user" column); a clean-up command for edits to starting users | **No**, that still needs me for the clean-up. Back up: the **wipe is the simplest**, and the audience is US employers, so pick the best time |

**Choice:**

| Piece | What it does |
|---|---|
| **Nightly reset** | When `DEMO_MODE` is on, a timer in the API empties the tables and adds the 50 starting users again, in one transaction, holding the same lock as the cap check |
| **When** | **08:00 UTC**: 4 AM Eastern and 1 AM Pacific in summer, 3 AM and midnight in winter. Fixed in UTC, so no daylight-saving code |
| **200-user cap** (kept) | A flood is refused with `409` until the next reset, so the demo heals itself within a day |
| Bad edits to starting users | Undone by the next reset |
| **Notice** | "Demo only: all data is fake and resets every night at 08:00 UTC", at the top of `/docs`, in the `POST /demo/token` response, and later in the web client |

**Tests (integrity):** make changes, run the reset → exactly the 50 starting users; a create during the reset waits, then counts correctly. The timer line itself isn't tested.

**Accepted downside:** anyone using the demo at 08:00 UTC loses their changes.

**As built:** `api/src/demo/`. The 50 starting users are generated in a fixed order from hand-written lists (shared last names, `O'Brien`, `Smith-Jones`, `St. Clair`, 3 phone formats, numbers in the 555-0100 to 0199 range reserved for fiction) and go through **the same validation and building code as a real create**. Phones and addresses are 1–3 each, not 0–3 as first planned: the API's own rules require at least one. The reset is `TRUNCATE` plus inserts in one transaction. **Changed from the plan: no advisory lock on the reset.** `TRUNCATE` already locks the table until the reset commits, so a create waits anyway, and a test of an extra lock could never fail; after my lock-removal check on the cap, the AI dropped that claim rather than keep an untestable one. A failed reset is logged with safe fields and changes nothing. `npm run dev:demo` runs demo mode locally. 9 integrity tests; 263 green; tried locally: 45 users over 3 pages.

**Origin:** changed (the AI's first proposal, which I turned down, then came back to with a reason: no upkeep, and the right hour for US visitors)
