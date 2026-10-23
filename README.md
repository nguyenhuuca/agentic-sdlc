# agentic-sdlc

A Claude Code setup you install into your own repository. It gives the agent a software delivery process instead of a blank prompt:

- **Planning flow**: idea → PRD → ADR → spec + sequence diagrams → plan, scaled to the size of the change.
- **Worker agents** pinned to a model per job (search on Haiku, code and review on Sonnet, architecture on Opus).
- **Gates**: tests first, review before commit, QA twice, and you approve every push.
- **Autopilot**: one small feature or fix end to end, locally or from a labelled GitHub issue.
- **Evolve**: the agent reads its own quality signals (escaped defects, reverts, user bug reports), finds the stage that missed each one, and proposes one rule change proven by a seeded-bug eval.
- **Session file**: `session.txt` keeps the task in flight, so a new session or another machine continues where work stopped.

Version 0.1.0 ([changelog](CHANGELOG.md)). Stack packs: Java (Maven), Node.js (npm), Python (pytest), Go; other stacks work with components written by hand in `sdlc.config.json`.

Docs: [how it works](docs/concepts/overview.md) · [sdlc.config.json and packs](docs/config.md) · [autopilot and Evolve on GitHub](docs/headless.md) · [decisions](docs/adr/)

## Install

Needs Node 20+ and git. In the root of your repository:

```bash
npx github:nguyenhuuca/agentic-sdlc init --dry-run      # list every file it would create, merge or leave alone
npx github:nguyenhuuca/agentic-sdlc init                # install (asks first; --yes in scripts)
npx github:nguyenhuuca/agentic-sdlc doctor              # check hooks, config, references and tools
```

Options: `--packs java-maven,node` to choose stack packs instead of detecting them, `--with autopilot,evolve` to add the GitHub Actions workflows (they need the `CLAUDE_CODE_OAUTH_TOKEN` secret), `--target <dir>` for another directory.

What it does to your repo:

- **Creates** `.claude/` (rules, agents, skills, hooks), `scripts/sdlc/`, `templates/artifacts/`, `evals/`, and `sdlc.config.json` with the commands it detected. Review the config: it is yours and is never rewritten.
- **Merges** `.claude/settings.json` (adds hooks and deny rules, keeps yours), a marked block in `CLAUDE.md`, and a few `.gitignore` lines.
- **Never overwrites** a file that already exists or that you changed: the new version is written next to it as `<file>.sdlc-new`.
- Records what it installed in `.agentic-sdlc/manifest.json` (commit it).

Later:

```bash
npx github:nguyenhuuca/agentic-sdlc update      # refresh files you have not edited; .sdlc-new for the rest
npx github:nguyenhuuca/agentic-sdlc uninstall   # remove unedited files and our hooks; deny rules stay
```

## Origin

The process was built and run day to day in a Java + React project. The core is written from scratch for this repository (see [ADR-0001](docs/adr/0001-clean-room-core.md)).

## License

MIT
