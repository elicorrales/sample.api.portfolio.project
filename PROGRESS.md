# Progress

**Last updated:** 2026-09-12

A quick "where are we" for resuming work. The full story is in [`project/docs/journal.md`](project/docs/journal.md), and the decisions are in [`project/docs/decisions/`](project/docs/decisions/README.md).

## Done

| Area | State |
|---|---|
| Design decisions | Logged in `project/docs/decisions/` (01–10) |
| Plain-language operations | `project/docs/spec/operations.md` (6 operations; was 16 before the "one user form, one save" revision) |
| OpenAPI spec | `project/api/openapi.yaml`: all 6 operations; phones and addresses are part of the user; passes lint; version 0.1.0 (1.0.0 once the web client proves it) |
| Docs page | `website/api-docs/index.html` (Swagger UI) |
| License | MIT, `LICENSE` |
| Test setup files | `project/package.json`, `tsconfig.json`, `vitest.config.ts`, `.nvmrc`, `.npmrc` |
| Code layout | Decision 06 decided: feature folders, layer in the filename (`users.routes.ts` → `users.service.ts` → `users.repository.ts`) |
| **Vertical slice: create user** | `POST /v1/users` works end to end: Zod validation, rules, in-memory repository, JWT auth, CORS, Problem Details errors. The other 5 operations answer `501`. Tried live from Swagger UI: `201`, then `409` on the same email. |
| **List users** | `GET /v1/users`: search, sort (ignoring case; tie-breakers always ascending), paging, page past the end → empty page. Tried from Swagger UI. |
| Happy-path tests | **7 green:** `users.create.test.ts` (2), `users.list.test.ts` (5). Helper `tests/helpers/users.ts` (`createUser`, `userInput`) |
| VM symlinks | Enabled for the shared folder on the host (`SharedFoldersEnableSymlinksCreate`). Installs, tests, and servers run on the laptop (the VM is memory-limited). |
| Root README | Entry point for recruiters, employers, and devs: status, AI collaboration, reading order, run commands, links to my other work |

## Next steps

1. **Remaining happy-path tests, one operation at a time** (write red → build → green → try in Swagger):

   | # | Operation | Test |
   |---|---|---|
   | 5 | Get one | **Next.** Basic (default), then `view=detailed`; `ETag` |
   | 6 | Update | Change name, replace phones, new primary → version 2 |
   | 7 | Update | Reduce to 1 phone, no primary marked → automatic primary |
   | 8 | Delete | Hidden from list/get; visible with `includeDeleted` |
   | 9 | Restore | Back in the list, phones and addresses intact |
   | — | Workflow | Create → list → get → edit → delete → restore, same user |

   Open question for bad calls: unknown query parameters (`?foo=1`) are ignored for now; 400 instead?
2. **Bad-calls tests** next; walk through the list before writing them
3. **Later:** PGlite → native PostgreSQL; integrity, security, rate-limit, and performance tests; admin web client; hosting (Netlify docs page, Render API)
4. **Once the docs page is on Netlify:** add this API to the [projects landing page](https://all-my-projects-landing-page.netlify.app/), and add the live docs link to `README.md` (it has local-only instructions for now)

## Useful commands (from `project/`)

| Command | Does |
|---|---|
| `npm test` | Run all tests once |
| `npm run test:watch` | Re-run tests on file changes |
| `npm run typecheck` | TypeScript check |
| `npm run lint:spec` | Lint the OpenAPI spec |
| `npm run dev` | Start the API on port 3000 (dev secret; allows the docs page on 8080 via CORS). Data is in memory and lost on restart. |
| `npm run token` | Print an admin token (8 hours) to paste into Swagger UI's **Authorize** |

**Try the API in Swagger UI:** `npm run dev` in one terminal; `python3 -m http.server 8080` from the repo root in another; open `http://localhost:8080/website/api-docs/`; click **Authorize** and paste the output of `npm run token`; then **Try it out**.

## Working agreements

- I stay involved in each step: propose and explain briefly, then I decide
- Short answers (tables and bullets)
- Log decisions in `project/docs/decisions/` and a journal row after each step, with origin tags (mine / picked / suggested / changed)
- Everything installed local to the repo; no global packages
- I commit and push myself
