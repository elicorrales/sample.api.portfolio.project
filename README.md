# Users Admin API

A REST API for managing users, their phones, and their addresses. It is built **spec-first** and **test-first**, and every design decision is written down.

I'm building it as a portfolio piece and as an honest record of how a real API gets started: the questions, the tradeoffs, the mistakes, and how I work with an AI assistant without handing it the wheel.

## Status

| Stage | State |
|---|---|
| Design decisions | ✅ Logged (10 topics) |
| OpenAPI spec | ✅ All 6 operations, passes lint (v0.1.0) |
| First vertical slice | ✅ Create user works end to end (tests green, callable from Swagger UI) |
| List users | ✅ Search, sort, paging (tests green, callable from Swagger UI) |
| Other 4 operations | 🔴 In progress: tests first, then code, one operation at a time |
| Hosting | ⏳ Later: docs page on Netlify, API on Render |

Details: [PROGRESS.md](PROGRESS.md)

## What's worth a look

- **Spec before code.** The contract ([`openapi.yaml`](project/api/openapi.yaml)) was written and linted before any endpoint existed.
- **Tests before code.** Each test is written first and must fail for the right reason before any code is written to pass it.
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
| 4 | The formal contract | [OpenAPI spec](project/api/openapi.yaml) · [docs page](website/api-docs/index.html) |
| 5 | The tests | [`project/tests/`](project/tests/) |
| 6 | The code | [`project/api/src/`](project/api/src/) |

## Tech stack

Node.js 24 · TypeScript · Express 5 · Vitest · Supertest · PostgreSQL (planned: in-memory fakes, then PGlite, then native PostgreSQL) · Redocly (spec linting) · Swagger UI (docs page)

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
| `npm test` | Run all tests once |
| `npm run test:watch` | Re-run tests on file changes |
| `npm run typecheck` | TypeScript check |
| `npm run lint:spec` | Lint the OpenAPI spec |
| `npm run dev` | Start the API on port 3000 (in-memory data, lost on restart) |
| `npm run token` | Print an admin token for Swagger UI's **Authorize** button |

To try the API from the docs page: run `npm run dev`; in another terminal, run `python3 -m http.server 8080` from the repo root; open `http://localhost:8080/website/api-docs/`; click **Authorize** and paste the output of `npm run token`.

## More of my work

- [LinkedIn](https://www.linkedin.com/in/eli-corrales-7182a4374/)
- [All my projects](https://all-my-projects-landing-page.netlify.app/): 3D game worlds run as online services, a local-first crypto wallet, and more
- [Mentella welcome automation](https://github.com/elicorrales/mentella-welcome-automation): a prototype built in response to a job posting, with the full AI chat transcripts included

## License

[MIT](LICENSE)
