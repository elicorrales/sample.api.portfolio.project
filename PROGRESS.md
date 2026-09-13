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
| App skeleton | `project/api/src/app.ts` answers `501` to everything; `server.ts` listens on 3000 |
| First test | `project/tests/happy-path/users.create.test.ts`: sends one phone and one address; installed and run; red as intended (`expected 501 to be 201`) |
| VM symlinks | Enabled for the shared folder on the host (`SharedFoldersEnableSymlinksCreate`); `ln -s` test passed. Install and tests were run on the laptop. |
| Root README | Entry point for recruiters, employers, and devs: status, AI collaboration, reading order, run commands, links to my other work |

## Next steps

1. **Write the remaining failing tests**, one category at a time, starting with happy path, then bad calls. Walk through each category's test list before writing it.
2. **Build the real code** (routes → service → repository, in-memory fakes first) until tests turn green
3. **Later:** PGlite → native PostgreSQL; integrity, security, rate-limit, and performance tests; admin web client; hosting (Netlify docs page, Render API)
4. **Once the docs page is on Netlify:** add this API to the [projects landing page](https://all-my-projects-landing-page.netlify.app/), and add the live docs link to `README.md` (it has local-only instructions for now)

## Useful commands (from `project/`)

| Command | Does |
|---|---|
| `npm test` | Run all tests once |
| `npm run test:watch` | Re-run tests on file changes |
| `npm run typecheck` | TypeScript check |
| `npm run lint:spec` | Lint the OpenAPI spec |
| `npm run dev` | Start the API on port 3000 |

View the docs page: from the repo root, run `python3 -m http.server 8080`, then open `http://localhost:8080/website/api-docs/`.

## Working agreements

- I stay involved in each step: propose and explain briefly, then I decide
- Short answers (tables and bullets)
- Log decisions in `project/docs/decisions/` and a journal row after each step, with origin tags (mine / picked / suggested / changed)
- Everything installed local to the repo; no global packages
- I commit and push myself
