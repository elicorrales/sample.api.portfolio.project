# 09 — Docs, memory, and capturing the process

**Date:** 2026-09-12 · **Status:** Decided

## Question

Where should project knowledge live: repo docs, or the AI assistant's memory?

| | Docs in the repo | Claude memory | `CLAUDE.md` in the repo |
|---|---|---|---|
| Visible to employers | Yes | No, local to my machine | Yes |
| Tracked in git | Yes | No | Yes |
| Loaded automatically in new sessions | No, only when read | Yes (the index) | Yes |
| Works with other tools and AIs | Yes | Claude Code only | Mostly |
| Drift risk | Yes, but reviewable | Yes, and invisible | Yes |
| Best for | Decisions, spec, process | Personal working preferences | Project rules for any session |

## Choice

- **Repo docs are the record.** Decisions and spec go in `project/docs/`.
- **Memory holds pointers and preferences only.** Same approach as my game projects.

**Origin:** mine (continuing my existing habit)

## Capturing the process for the portfolio

The portfolio website should show **how** the design was reached, not only the result.

| Source | Use |
|---|---|
| This decision log | Main material for the website |
| Raw Claude Code session transcripts (saved locally as `.jsonl`) | Source material; too noisy to publish as-is |
| My earlier chat with another AI | The cross-check story ([01](01-ai-cross-check.md)) |

**What to highlight:** the places marked **changed**, where I modified or overruled a suggestion. Also the decision chains, e.g. choosing optimistic locking made PUT the better fit ([07](07-users.md)).

## Working style

- I stay involved in each step. The AI proposes and explains briefly; I decide.
- Short answers (tables, bullets); I ask follow-ups to go deeper.
- Decisions are recorded here as they're made, not reconstructed later.
