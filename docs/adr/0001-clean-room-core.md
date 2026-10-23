# ADR-0001: Clean-room core

Status: accepted (2026-10-23)

## Context

This setup grew inside `nguyenhuuca/assessment` on top of `dralgorhythm/claude-agentic-framework` v5. That repository ships without a license ("nothing here should be read as a license grant"), so its text cannot be republished. About 90 of the ~115 framework files in assessment came from it, with or without edits; the rest (autopilot, Evolve, metrics, cost, session file) were written by the owner.

## Decision

1. The core (rules, worker agents, core skills, hooks) is written from scratch. Names of files, skills and concepts may match; sentences, tables and examples may not.
2. Owner-written parts are ported as they are, minus project-specific details.
3. Each new file is written from a short behavior brief, not with the old file open.
4. `scripts/check-clean-room.mjs` compares every 10-word run in this repo with an upstream checkout. CI fails on a match. `.clean-room-allow` lists the few non-creative phrases that may repeat; each needs a reason in review.
5. MIT license.

## Consequences

- One install command, no dependency on an unlicensed repo.
- More work up front: the core is new text, and behavior may differ from upstream in places.
- The check catches copied sentences, not close paraphrase; brief-first writing (point 3) covers that gap.
- When the check was first run, the owner-written assessment files had no match, and the upstream-derived rules and agents had 493.
