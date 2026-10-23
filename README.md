# agentic-sdlc

A Claude Code setup you install into your own repository. It gives the agent a software delivery process instead of a blank prompt:

- **Planning flow**: idea → PRD → ADR → spec + sequence diagrams → plan, scaled to the size of the change.
- **Worker agents** pinned to a model per job (search on Haiku, code and review on Sonnet, architecture on Opus).
- **Gates**: tests first, review before commit, QA twice, and you approve every push.
- **Autopilot**: one small feature or fix end to end, locally or from a labelled GitHub issue.
- **Evolve**: the agent reads its own quality signals (escaped defects, reverts, user bug reports), finds the stage that missed each one, and proposes one rule change proven by a seeded-bug eval.
- **Session file**: `session.txt` keeps the task in flight, so a new session or another machine continues where work stopped.

Status: under construction (v0.1.0 target). Plan: [`docs/plans/plan-agentic-sdlc.md`](docs/plans/plan-agentic-sdlc.md).

## Install (planned)

```bash
npx github:nguyenhuuca/agentic-sdlc init --dry-run   # show what would change
npx github:nguyenhuuca/agentic-sdlc init             # install
npx github:nguyenhuuca/agentic-sdlc update           # later: update files you have not edited
```

The installer detects your stack, writes the commands it found to `sdlc.config.json`, and never overwrites a file you changed.

## Origin

The process was built and run day to day in a Java + React project. The core is written from scratch for this repository (see [ADR-0001](docs/adr/0001-clean-room-core.md)).

## License

MIT
