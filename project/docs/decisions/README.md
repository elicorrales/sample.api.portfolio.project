# Decision Log

How this API's design was reached: the questions asked, the options weighed, and what was chosen and why.

Each file covers one topic. Each decision records:

- **Question**: what needed deciding
- **Options**: what was on the table, with tradeoffs
- **Choice**: what was picked
- **Why**: the reasoning
- **Origin**: who the decision came from (see key below)

## Who's who

These docs are written in my voice: **I / my / mine** means me, the project author. **The AI** means Claude, the assistant I worked with in Claude Code.

| Origin tag | Meaning |
|---|---|
| **mine** | My idea |
| **picked** | The AI listed options or examples; I chose |
| **suggested** | The AI recommended one answer; I accepted |
| **changed** | I modified or overruled an AI suggestion |

**Status** is either **Decided** or **Proposed** (discussed but not yet confirmed).

## Topics

| # | Topic | Status |
|---|---|---|
| 01 | [Cross-checking earlier AI advice](01-ai-cross-check.md) | Decided |
| 02 | [Tech stack](02-stack.md) | Decided |
| 03 | [Test strategy](03-test-strategy.md) | Decided |
| 04 | [Admin API vs self-service](04-admin-vs-self-service.md) | Decided |
| 05 | [Hosting and public demo](05-hosting.md) | Partly decided |
| 06 | [Code layering and folders](06-layering.md) | Decided |
| 07 | [Users](07-users.md) | Decided |
| 08 | [Phones and addresses](08-phones-addresses.md) | Decided |
| 09 | [Docs, memory, and capturing the process](09-docs-and-process.md) | Decided |
| 10 | [API conventions (mapping operations to HTTP)](10-api-conventions.md) | Decided |
| 11 | [Database (Drizzle + PostgreSQL)](11-database.md) | Decided |
| 12 | [Encrypting user data](12-encryption.md) | Decided: documented, not built |

## Open items

- Pick how public demo visitors get an admin token (05)
- Keep personal data out of server logs before hosting (11)
- Confirm the folder layout (06)
- Write the OpenAPI file from the reviewed [plain-language operations list](../spec/operations.md) and the [API conventions](10-api-conventions.md)

See also the step-by-step [project journal](../journal.md).
