# Progress

**Last updated:** 2026-09-12

A quick "where are we" for resuming work. The full story is in [`project/docs/journal.md`](project/docs/journal.md), and the decisions are in [`project/docs/decisions/`](project/docs/decisions/README.md).

## Done

| Area | State |
|---|---|
| Design decisions | Logged in `project/docs/decisions/` (01–10) |
| Plain-language operations | `project/docs/spec/operations.md` (16 operations) |
| OpenAPI spec | `project/api/openapi.yaml`: all 16 operations; passes lint; version 0.1.0 (1.0.0 once the web client proves it) |
| Docs page | `website/api-docs/index.html` (Swagger UI) |
| License | MIT, `LICENSE` |
| Test setup files | `project/package.json`, `tsconfig.json`, `vitest.config.ts`, `.nvmrc`, `.npmrc` |
| App skeleton | `project/api/src/app.ts` answers `501` to everything; `server.ts` listens on 3000 |
| First test | `project/tests/happy-path/users.create.test.ts` |

## In progress: blocked on install

`npm install` fails inside the VM: the VirtualBox shared folder doesn't allow symbolic links, and npm needs them for `node_modules/.bin`.

**Options:**

| Option | How |
|---|---|
| A. Install on the laptop | Run the commands below on the host, not in the VM |
| B. Allow symlinks in the shared folder | On the **host**, with the VM fully powered off: `VBoxManage setextradata "<VM name>" VBoxInternal2/SharedFoldersEnableSymlinksCreate/<share name> 1`, then start the VM. Find names with `VBoxManage list vms` and the VM's Shared Folders settings (the share name is the folder name without the `sf_` prefix). Test with `ln -s api linktest` inside `project/`. |
| C. `npm install --no-bin-links` in the VM | Works, but npm scripts would need long paths |

## Next steps

1. **Install and run the first test**
   ```
   cd project
   nvm use
   npm install
   npm test
   ```
   **Expected:** 1 failed test, `expected 501 to be 201`. This is the intended "red": the test runs and fails for the right reason.
2. **Log test setup** in `project/docs/journal.md` (row 20) once the red test is confirmed
3. **Write the remaining failing tests**, one category at a time, starting with happy path, then bad calls. Walk through each category's test list before writing it.
4. **Build the real code** (routes → service → repository, in-memory fakes first) until tests turn green
5. **Later:** PGlite → native PostgreSQL; integrity, security, rate-limit, and performance tests; admin web client; hosting (Netlify docs page, Render API)

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
