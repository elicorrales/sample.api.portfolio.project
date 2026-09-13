# Users Admin API

A REST API for managing users, their phones, and their addresses. It is built **spec-first** and **test-first**, and every design decision is written down.

I'm building it as a portfolio piece and as an honest record of how a real API gets started: the questions, the tradeoffs, the mistakes, and how I work with an AI assistant without handing it the wheel.

## Status

| Stage | State |
|---|---|
| Design decisions | ✅ Logged (12 topics) |
| OpenAPI spec | ✅ All 6 operations, passes lint (v0.1.0) |
| First vertical slice | ✅ Create user works end to end (tests green, callable from Swagger UI) |
| List users | ✅ Search, sort, paging (tests green, callable from Swagger UI) |
| Get one user | ✅ Basic and detailed views (tests green, callable from Swagger UI) |
| Update user | ✅ Whole-user replace with optimistic locking (tests green, callable from Swagger UI) |
| Delete user | ✅ Marked as deleted; visible with `includeDeleted` (tests green, callable from Swagger UI) |
| Restore user | ✅ Brings back a deleted user (tests green, callable from Swagger UI) |
| Tests | ✅ 263 green; see [Tests](#tests) below |
| Storage | ✅ PostgreSQL 18 via Drizzle; locally a real server run from `node_modules` (`embedded-postgres`), hosted later through `DATABASE_URL` |
| Hosting | ⏳ Next: API and its Swagger page on Render (docs stay on GitHub) |

Details: [PROGRESS.md](PROGRESS.md)

## Tests

**What the API refuses matters more than what it accepts.** Most of the suite proves that bad input, stale versions, conflicts, wrong paths, forged tokens, attacks, and colliding requests fail the right way.

| Category | What it proves | Tests | Status |
|---|---|---|---|
| **Bad calls** | Every kind of client mistake gets the right status and an error naming the field: `José` → 400, stale version → 412, deleted user's email → 409, `<script>` never echoed back; a typo in the server's settings (`DEMO_MODE=yes`) stops it from starting; a full demo refuses new users | **132** | ✅ |
| **Security** | Forged tokens (`alg: none`, edited role, no expiry) → 401; no token → 401 before anything else is checked; SQL in `search`/`sort` does nothing; a forced crash leaks no SQL or file paths, and **the server's own log holds no names or emails**; look-alike origins get no CORS; the public docs can't be used to reach other files; a demo token stops working after 1 hour, and doesn't exist outside demo mode. **Found 2 real holes**, now fixed | **78** | ✅ |
| **Integrity** | Two requests forced to collide: same email → one `201`, one `409`; same version → one `200`, one `412`, saved once; a save failing midway leaves nothing half-written; two creates racing for the last spot → exactly one saved (**checked by deleting the lock and watching the test fail**); the demo's nightly reset that fails midway changes nothing. **Found 1 real bug** (`500` instead of `409` in a race), now fixed | **24** | ✅ |
| **Rate limiting** | Over 100 requests a minute → `429` with `Retry-After`; token-guessing floods and faked IP headers are stopped too; a blocked create saves nothing | **12** | ✅ |
| **Performance** | Search and paging stay fast at scale | — | ⏳ Planned |
| **Encryption** | Personal fields are stored encrypted (the raw database row never holds the plain value); a wrong key fails loudly; rotated keys still read old data. Designed, not built: [decision 12](project/docs/decisions/12-encryption.md) explains why and what it would take | — | 📝 Designed only |
| Happy path + workflow | Each operation works, and they work together | 17 | ✅ |

**The full showcase,** with example cases for every group and what the tests found: [project/docs/testing.md](project/docs/testing.md)

## What's worth a look

- **Spec before code.** The contract ([`openapi.yaml`](project/api/openapi.yaml)) was written and linted before any endpoint existed.
- **Tests before code.** Each test is written first and must fail for the right reason before any code is written to pass it.
- **201 bad-call, security, integrity, and rate-limit tests vs 17 happy-path.** Most of the work is proving what the API refuses ([tests](project/docs/testing.md)).
- **Storage swapped twice, tests unchanged.** In-memory → PGlite → a real PostgreSQL server; no test changed, and the tests caught the one behavior that differed ([decision 11](project/docs/decisions/11-database.md#what-the-swap-found)).
- **Encryption, thought through but not built.** What protects user data in transit and at rest, why field-level encryption would break search and the unique email rule, and what doing it properly would take ([decision 12](project/docs/decisions/12-encryption.md)).
- **Decisions on paper.** Every choice records the question, the options, what was picked, and why ([decision log](project/docs/decisions/README.md)).
- **A visible AI trail.** See below.

## How I use AI on this project

I work with Claude (in Claude Code) as a fast partner, not an oracle. The AI proposes; I decide. I also keep a record of who each idea came from.

- **Credit tags.** Every decision is tagged **mine**, **picked** (I chose from the AI's options), **suggested** (I accepted its recommendation), or **changed** (I modified or overruled it). When I audited the log, the AI had credited me for choices I had only picked from its options, so I retagged them. ([Key](project/docs/decisions/README.md#whos-who))
- **Pushback is recorded.** The [journal](project/docs/journal.md) notes where I challenged the AI, including a wrong claim it made about JSON error formats, a docs setup that required manual copying, and a name-length limit that didn't match real names.
- **I run things myself.** I ran the first red test by hand before moving on, so I saw the failure with my own eyes.

**New to development?** You don't need AI to learn, but if you use it, ask it to explain its reasoning, question its claims, and keep your own record of what you decided and why.

## Where to look

Suggested reading order if you want to see how a project starts:

| # | What | Where |
|---|---|---|
| 1 | The story, step by step | [Journal](project/docs/journal.md) |
| 2 | Why things are the way they are | [Decision log](project/docs/decisions/README.md) |
| 3 | What the API does, in plain language | [Operations list](project/docs/spec/operations.md) |
| 4 | The formal contract | [OpenAPI spec](project/api/openapi.yaml) (the API serves it as Swagger UI at `/docs`) |
| 5 | The tests, and what they prove | [Test showcase](project/docs/testing.md) · [`project/tests/`](project/tests/) |
| 6 | The code | [`project/api/src/`](project/api/src/) |

## Tech stack

Node.js 24 · TypeScript · Express 5 · Zod · PostgreSQL 18 · Drizzle ORM · `pg` · embedded-postgres (local PostgreSQL server, no system install) · Vitest · Supertest · Redocly (spec linting) · Swagger UI (docs page)

## Run it locally

Requires Node 24 ([nvm](https://github.com/nvm-sh/nvm) recommended).

```
cd project
nvm use
npm install
npm test
```

| Command (from `project/`) | Does |
|---|---|
| `npm test` | Run all tests once (about 22 s; starts a local PostgreSQL server automatically) |
| `npm run test:bad-calls` | Run only the bad-call tests |
| `npm run test:security` | Run only the security tests |
| `npm run test:rate-limit` | Run only the rate-limit tests |
| `npm run test:integrity` | Run only the integrity tests |
| `npm run test:happy-path` | Run only the happy-path and workflow tests |
| `npm run test:watch` | Re-run tests on file changes |
| `npm run typecheck` | TypeScript check |
| `npm run lint:spec` | Lint the OpenAPI spec |
| `npm start` | Start the API the way Render does (plain `node`; needs `JWT_SECRET` and `DATABASE_URL`) |
| `npm run dev` | Start the API on port 3000 with auto-restart (starts a local PostgreSQL too; data saved in `project/.data/postgres`, kept between restarts) |
| `npm run dev:demo` | Same, in demo mode, as on Render: 50 starting users on an empty database, `POST /demo/token`, a 200-user limit, nightly reset |
| `npm run db:generate` | Write a new SQL migration after changing the tables |
| `npm run token` | Print an admin token for Swagger UI's **Authorize** button |

To try the API from its docs page: run `npm run dev`; open `http://localhost:3000/docs`; click **Authorize** and paste the output of `npm run token`.

## More of my work

- [LinkedIn](https://www.linkedin.com/in/eli-corrales-7182a4374/)
- [All my projects](https://all-my-projects-landing-page.netlify.app/): 3D game worlds run as online services, a local-first crypto wallet, and more
- [Mentella welcome automation](https://github.com/elicorrales/mentella-welcome-automation): a prototype built in response to a job posting, with the full AI chat transcripts included

## License

[MIT](LICENSE)
