# 02 — Tech stack

**Date:** 2026-09-12 · **Status:** Decided (confirmed at test setup)

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

## Confirmed at test setup

| # | Question | Choice | Why | Origin |
|---|---|---|---|---|
| 1 | Language | **TypeScript** | Expected by employers; catches mistakes early | suggested |
| 2 | Test runner | **Vitest** | Smooth with TypeScript; polished output | suggested |
| 3 | Node version | **24 LTS**, pinned in `.nvmrc` | Installed on both my laptop (via nvm) and the dev VM; supported by Render | suggested |
| 4 | Where `package.json` lives | **One in `project/`**, covering API and tests | Simplest; tests import the app directly | suggested |
| 5 | Module style | **`import`** (ES modules) | Current standard | suggested |
| 6 | Tooling installs | **Everything local to the repo:** no global packages; exact versions (`.npmrc` `save-exact`); `node_modules` ignored by git | My standing preference | mine |

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
