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
| 02 | [Tech stack](02-stack.md) | Proposed |
| 03 | [Test strategy](03-test-strategy.md) | Decided |
| 04 | [Admin API vs self-service](04-admin-vs-self-service.md) | Decided |
| 05 | [Hosting and public demo](05-hosting.md) | Partly decided |
| 06 | [Code layering and folders](06-layering.md) | Proposed |
| 07 | [Users](07-users.md) | Decided |
| 08 | [Phones and addresses](08-phones-addresses.md) | Decided |
| 09 | [Docs, memory, and capturing the process](09-docs-and-process.md) | Decided |

## Open items

- Confirm the tech stack (02)
- Pick how public demo visitors get an admin token (05)
- Confirm the folder layout (06)
- Plain-language list of every operation, then the OpenAPI file
