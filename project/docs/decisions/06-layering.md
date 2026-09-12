# 06 — Code layering and folders

**Date:** 2026-09-12 · **Status:** Proposed

## Context

Before choosing a layout for this API, I had Claude compare how my earlier projects are organized.

## Earlier projects

**Ancient Halls** (multiplayer game)

| Level | Organized by | Evidence |
|---|---|---|
| Top | Tier | `client/`, `server/`, golden tests |
| Client subdirs | **Layer** | `ui/` → `engine/` → `sim/` (rules) → `render/`, `audio/` |
| Server | Flat | Identity, moderation, rankings, and scripts side by side |

**Countryside** (multiplayer game)

| Level | Organized by | Evidence |
|---|---|---|
| Top | Tier | `countryside/` (client), `countryside-server/`, `tests/client`, `tests/server` |
| Client subdirs | Mixed | Features: `snake/`, `storm/`, `predator/`. Layers: `render/`, `net/`, `audio/`, `collision/` |
| Inside a feature folder | Layer in the **filename** | `storm-audio`, `storm-clouds` (render), `storm-safety` (rules) |
| Server | Mostly flat, plus feature folders | `snake/`, `storm/` |

**AllMyMoneyBags** (crypto wallet)

| Folder | Runs in | Layer |
|---|---|---|
| `wallet-*-ui-js`, `wallet-ui-common-js` | Browser page | Presentation, one folder per screen |
| `wallet-libs` | Browser page | Core/domain (keys, state); persistence mixed in |
| `wallet-network-utils` | Browser page | External adapters, one per blockchain |
| `wallet-config` | Browser page | Configuration |
| `wallet-browser-extension`, `wallet-iframe` | Extension / iframe | Messaging bridge |
| `proxy-handlers` → `proxy-lib` | Node proxy | Request handlers → shared library code |
| `all-my-money-bags-helpers` | Node launcher | Process orchestration |

## Comparison

| | Games | Wallet |
|---|---|---|
| First split | Client vs server | Which process the code runs in |
| Second split | Layer (AH), or feature + layer (CS) | Layer, plus per-screen UI folders |
| Where layers show | Folder names or filename suffixes | Folder names |
| Dependency direction | Implied | Clearest in `proxy-handlers` → `proxy-lib` |

## Proposal for this API

Countryside's approach: **feature folders, with the layer in the filename.**

```
project/api/
  openapi.yaml
  src/
    app.ts                  builds the Express app (no listen, so tests can import it)
    server.ts               starts listening
    users/
      users.routes.ts       HTTP layer
      users.service.ts      business rules
      users.repository.ts   data access
      users.schema.ts       validation
    phones/     (same four files)
    addresses/  (same four files)
    shared/     auth, db, errors, middleware, config
project/tests/
  happy-path/  bad-calls/  integrity/  security/  rate-limit/
  fakes/       in-memory repositories
  perf/        load-test scripts
```

**Rule:** calls go routes → service → repository, never upward. This is what lets tests swap in fake repositories.

**Tests are grouped by category, not by feature,** because each category spans users, phones, and addresses.

**Origin:** suggested, based on my own Countryside layout
