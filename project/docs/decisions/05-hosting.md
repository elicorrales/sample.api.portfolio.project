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
