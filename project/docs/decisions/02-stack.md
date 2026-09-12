# 02 — Tech stack

**Date:** 2026-09-12 · **Status:** Proposed (not yet confirmed)

## What each piece does

| Tool | What it does | Why use it |
|---|---|---|
| Node.js | Runs the API | Runtime for the server |
| Express | Web server framework | Defines routes like `GET /users` |
| PostgreSQL | Database | Data is relational: 1 user → many phones and addresses |
| Prisma | Database access and migrations | Easier queries and schema changes |
| Zod | Validates incoming data | Rejects bad requests before they reach the database |
| JWT | Auth tokens | Proves the caller is an admin |
| OpenAPI / Swagger | Spec plus interactive docs | One contract for docs, tests, and validation |
| TypeScript | Typed JavaScript | Catches mistakes early; commonly expected by employers |
| Vitest | Test runner | Assertions, hooks, mocking, watch mode, coverage |
| Supertest | Calls Express endpoints in tests | No running server or browser needed |

## Decisions within the stack

| Question | Choice | Why | Origin |
|---|---|---|---|
| SQL or NoSQL? | PostgreSQL | Relationships between users, phones, and addresses | suggested |
| Validation now or later? | Now | "Bad calls" tests need it | suggested (correction in 01) |
| Auth now or later? | Early | Security tests need to know who is calling | suggested (correction in 01) |
| Plain `node` or a test runner? | Vitest (proposed) | Less plumbing. Node's built-in runner is a valid alternative. | suggested |

## OpenAPI vs Swagger

- **OpenAPI** is the spec format: a YAML or JSON file that describes endpoints, inputs, outputs, and errors.
- **Swagger** is the tooling around it: Swagger UI (docs page), Swagger Editor.
- The format was called "Swagger" until 2016, when it was renamed OpenAPI. That's why the names get mixed up.
- Use **OpenAPI 3.1**.

```
openapi.yaml  (written first)
   ├─→ Swagger UI   → docs page employers can try
   ├─→ tests        → check responses match the spec
   └─→ validation   → optionally reject bad requests automatically
```
