# Project Journal

How this project came together, step by step. Each step links to the detailed record.

Written in my voice: **I** means me, the project author, and **the AI** means Claude in Claude Code. See the [decision log key](decisions/README.md#whos-who).

## 2026-09-12 — From idea to spec

| # | Step | What happened | Record |
|---|---|---|---|
| 1 | Initial plan | Sketched the project with a different AI assistant: a Node/Express/PostgreSQL users API, built test-first. | [01](decisions/01-ai-cross-check.md) |
| 2 | Second opinion | Gave that whole chat to Claude to confirm or dispute. It caught an outdated claim about Node's test tooling, and several items the plan put off too long (validation, auth). | [01](decisions/01-ai-cross-check.md) |
| 3 | Stack and tests | Learned what each tool does. Defined my own test categories: happy path, bad calls, integrity, security, performance, rate limiting. | [02](decisions/02-stack.md), [03](decisions/03-test-strategy.md) |
| 4 | Scope | Chose an admin-only API first; self-service logins later. | [04](decisions/04-admin-vs-self-service.md) |
| 5 | Hosting | Planned local first, then Render (API + Swagger UI) and Netlify (pages), the services I already use. Identified the problem of letting demo visitors use an admin API. | [05](decisions/05-hosting.md) |
| 6 | Code layout | Had the AI compare the folder structure of my three earlier projects before proposing one for this API. | [06](decisions/06-layering.md) |
| 7 | User rules | Worked through fields, views, search, delete/restore, and locking in short question-and-answer rounds. **Key moment:** choosing optimistic locking removed PATCH's main advantage, so I chose PUT. | [07](decisions/07-users.md) |
| 8 | Phones and addresses | Set ownership, delete, and validation rules. Tightened several suggestions: one phone per type, 3 addresses max, 5-digit ZIP only. | [08](decisions/08-phones-addresses.md) |
| 9 | Record keeping | Decided repo docs are the record and AI memory holds only pointers. Backfilled this decision log from the conversation. | [09](decisions/09-docs-and-process.md) |
| 10 | Credit audit | Reviewed who each decision came from. The AI had credited me for several choices I had actually picked from its options, so I added a **picked** tag and retagged those decisions. | [Decision log key](decisions/README.md#whos-who) |
| 11 | Tooling fix | The Claude Code diff panel couldn't read git. Cause: the repo sits in a VirtualBox shared folder, where files appear owned by `root` and marked executable. Fixed with git's `safe.directory` and `core.fileMode false`. | — |
| 12 | Operations list | Turned the decisions into a plain-language list of all 16 operations, the step before the formal OpenAPI file. Filling in details surfaced five new questions; I accepted all five proposals. | [Operations](spec/operations.md) |
| 13 | HTTP conventions | The AI mapped the operations to paths, methods, and status codes, with 8 convention choices. Before accepting, I checked each choice from two angles: security and the future web client. That surfaced five extra rules (page size cap, sort allowlist, auth before existence, no leaked internals, CORS headers). **Pushback:** I challenged the AI's claim that the standard error format wasn't JSON. It is; the AI corrected its framing. | [10](decisions/10-api-conventions.md) |
