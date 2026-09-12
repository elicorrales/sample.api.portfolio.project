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
