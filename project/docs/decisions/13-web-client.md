# 13 — Admin web client

**Date:** 2026-09-13 · **Status:** Partly decided (look and stack chosen; setup, build, and deploy still open)

A single-page app in `website/` that calls the live API, hosted as a Render static site ([decision 05](05-hosting.md#web-client-on-render-not-netlify-2026-09-13)). Besides the usual list, create, edit, delete, and restore, it has a place for visitors to watch the API refuse things: get a token, flood the rate limit, save a stale copy, and so on.

## Look and feel: the engineering notebook (2026-09-13)

Before any code, the AI made 5 static mockups in [`website/public/mockups/`](../../../website/public/mockups/), each showing the same two screens (users, and the checks) so only the look differed.

Click a picture for the full page.

| # | Picture | Mockup | Look | Checks screen |
|---|---|---|---|---|
| A | <a href="../../../website/public/mockups/screenshots/a-clean-tool.png"><img src="../../../website/public/mockups/screenshots/a-clean-tool.png" width="220" alt="Mockup A: clean internal tool"></a> | Clean internal tool | Light, one blue accent, edit panel on the right | List of checks, last response beside it |
| B | <a href="../../../website/public/mockups/screenshots/b-dev-console.png"><img src="../../../website/public/mockups/screenshots/b-dev-console.png" width="220" alt="Mockup B: developer console"></a> | Developer console | Dark slate, 3 panes, request log always open | 105-square grid for the rate-limit run |
| **C** | <a href="../../../website/public/mockups/screenshots/c-notebook.png"><img src="../../../website/public/mockups/screenshots/c-notebook.png" width="220" alt="Mockup C: engineering notebook (picked)"></a> | **Engineering notebook (picked)** | **Green grid paper, ink blue, red pencil; Newsreader + Spline Sans Mono** | **Each check is an experiment: claim, method, prediction, stamped result** |
| D | <a href="../../../website/public/mockups/screenshots/d-dense-grid.png"><img src="../../../website/public/mockups/screenshots/d-dense-grid.png" width="220" alt="Mockup D: dense back-office grid"></a> | Dense back-office grid | Small type, 20 rows, edit inside the row | Checks docked at the bottom |
| E | <a href="../../../website/public/mockups/screenshots/e-bold-modern.png"><img src="../../../website/public/mockups/screenshots/e-bold-modern.png" width="220" alt="Mockup E: bold modern"></a> | Bold modern | Big type, thick black lines, bright color | Tiles led by a giant status code |

**Seeing, not just reading.** I asked that visitors can see the mockups, not only read about them:

- **Screenshots** (above): 1440 px wide pages at 2× sharpness, taken in Chrome's device toolbar with "Capture full size screenshot". My first try was a picture of my screen (1912 × 858, zoomed, cut off), and it showed a real layout bug: form boxes running past their column in A, B, C, and E. Fixed before retaking
- **The pages themselves** live in `website/public/`, so Vite copies them into the build and they're served with the client at `/mockups/`

**Picked C.** Why:

- **Non-technical visitors can follow it.** "Claim, predict, result" reads as plain language, not an HTTP console
- It matches how the project was built: every test was predicted to fail before it was run (see the [journal](../journal.md))

**Origin:** picked (the AI proposed the 5 directions; I chose C for non-technical visitors)

**Found while making the mockups:** the list call returns only `id`, `firstName`, `lastName`, `email` (and `deletedAt` with `includeDeleted`). The first drafts showed city, phone count, and version in the table, which would need one extra call per row. Removed: the table shows what the list returns, and the full user loads when one is opened.

## Layout: the notebook lies open (2026-09-13)

**The problem with C as picked:** the users screen put the list on top and the opened user below it, so every edit meant scrolling down to the form and back up to the list.

| Option | Downside |
|---|---|
| **Two-page spread: list on the left page, opened user on the right** | Needs a wide screen (fine: [big screens only](#screen-size-big-screens-only-2026-09-13)) |
| Slide-over panel from the right | Covers the list while editing |
| Pop-up dialog | Cramped once a user has several phones and addresses |
| Its own page (`/users/:id`) | An extra click each way; the list is out of sight |
| Row opens in place | Pushes the rows below it down, so the scroll comes back |

**Picked the spread**, drawn as [mockup C2](../../../website/public/mockups/c2-notebook-spread.html):

<a href="../../../website/public/mockups/screenshots/c2-notebook-spread.png"><img src="../../../website/public/mockups/screenshots/c2-notebook-spread.png" width="440" alt="Mockup C2: the notebook open, users list on the left page, the opened user on the right"></a>

- It fits the notebook look: an open notebook has two facing pages
- Both pages are as tall as the window; each scrolls on its own only if its content is taller
- The Experiments tab works the same way: all experiments listed on the left page with a small status each, the chosen one on the right with the requests it sent and what came back. **First drawn as two entries per page:** the screenshot showed the half-width pages made the text wrap until the second entry ran off the page, so it was redrawn as list and detail
- Small links join the two screens, like "Try it: save a stale copy →" next to the saving note
- The tabs already kept the experiments off the admin's screen; this only fixes the scroll inside the users screen

**Origin:** mine to fix the scroll; the AI listed the 5 options and recommended the spread, and I agreed

## Stack: Vite + React + TypeScript (2026-09-13)

| Option | Pros | Cons |
|---|---|---|
| Plain HTML, CSS, JS (no build) | Nothing to install; Render publishes the folder as is; every line easy to follow | Hand-written page updates and screen switching; no type checking; weaker on a résumé |
| Vite + TypeScript, no framework | Same language as the API; types generated from `openapi.yaml`; small | A build step; still hand-written page updates |
| **Vite + React + TypeScript** | What most employers expect; components suit the repeated experiment entries and phone/address rows; same generated types | More packages and more to explain; I learn React along the way |

- **Types generated from the spec** carry "spec first" into the client: if the spec changes, the client stops compiling
- Vite builds a plain static folder, which is what a Render static site serves
- **I'm much more familiar with plain JS,** but chose React because it's what the project should show

**Origin:** suggested (I accepted the AI's recommendation over the option I know best)

## Screen size: big screens only (2026-09-13)

The client is built for a desktop or laptop screen, about 1280 px wide or more. No phone or tablet layout.

- It's an admin tool: people manage users at a desk, not on a phone
- A phone layout would double the layout work and the screenshots for no one who would really use it
- A visitor on a phone can still read the README, the journal, and the screenshots

**Origin:** mine

## Still open

- How the users screen and the experiments work in detail (which checks, how the rate-limit warning works)
- Local run against the Render API (`CORS_ORIGINS`), then deploy with build filters
