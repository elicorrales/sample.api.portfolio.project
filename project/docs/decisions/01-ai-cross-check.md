# 01 — Cross-checking earlier AI advice

**Date:** 2026-09-12 · **Status:** Decided

## Context

I first planned the project in a chat with a different AI assistant, then gave that whole chat to Claude (in Claude Code) to confirm or dispute. The goal was to not accept one AI's advice unchecked.

## What the first AI suggested

- Node.js + Express + PostgreSQL, with Swagger for docs
- Add Prisma, Zod, and JWT "later"
- A first version: users with many phones and many addresses
- API-first, test-first: write the contract, write failing tests, then build
- Vitest + Supertest for testing
- Performance and DDoS testing last
- A test runner is needed because plain `node` has no assertions, hooks, mocking, watch mode, or coverage

## What held up

| Claim | Verdict |
|---|---|
| Node + Express + PostgreSQL | Agreed. A solid, widely recognized stack |
| PostgreSQL for related data | Agreed |
| Contract first, then failing tests, then code | Agreed |
| Supertest for calling endpoints from tests | Agreed |
| Performance and DDoS last | Agreed |

## What didn't

| Claim | Correction |
|---|---|
| Plain `node` has no test features | **Outdated.** Node has a built-in test runner (`node:test`, `node --test`) with `describe`/`test`, hooks, mocking, watch mode, and coverage. A third-party runner is a preference, not a requirement. |
| Add Zod (validation) later | Needed from day one, since the "bad calls" tests depend on input validation. |
| Swagger is a docs page | Better used as **the spec itself** (OpenAPI), which tests can check responses against. |
| Add JWT (auth) later | Needed earlier, since isolation and security tests depend on knowing who is calling. |
| Test DDoS handling | You can't meaningfully test DDoS yourself. Test **rate limiting** instead (too many requests → `429`). |
| (Not mentioned) | **TypeScript**: commonly expected by employers, and pairs well with Zod and Prisma. |

## Takeaway

**Origin:** mine. I asked for a second opinion, and it caught one outdated fact and several ordering problems in the plan.
