# Admin web client

The admin page for managing users: a simple, professional CRUD screen, the kind a company builds for an internal tool. **Live at https://users-admin-web.onrender.com.** It calls the API hosted on Render and is hosted on Render too, as a static site ([decision 05](../project/docs/decisions/05-hosting.md#web-client-on-render-not-netlify-2026-09-13)).

**Meant for a big screen** (desktop or laptop, about 1280 px wide or more); there's no phone layout ([decision 13](../project/docs/decisions/13-web-client.md#screen-size-big-screens-only-2026-09-13)).

Built: demo token with countdown and expiry; users list with search and paging; add, edit, delete, and restore; an Experiments tab with a live rate-limit flood. 47 tests in `tests/`, non-happy cases first (see [PROGRESS](../PROGRESS.md)). The API's own Swagger docs are served by the API at `/docs`.

## Commands (from `website/`, Node 24.21.0 via `nvm use`)

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server at `http://localhost:5173` |
| `npm test` | Run the tests once |
| `npm run test:watch` | Re-run tests on file changes |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Type-check, then build the static site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |

The mockups are at `/mockups/index.html` (the full name; `/mockups/` shows the app).
