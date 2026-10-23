# Changelog

## 0.1.0 (2026-10-23)

First release.

- **Installer**: `init`, `update`, `doctor`, `uninstall`, with `--dry-run`, `--yes`, `--packs`, `--with`, `--target`. Files you edited, or that existed before, are never overwritten (`.sdlc-new` copies). `settings.json` is merged additively; `CLAUDE.md` gets a managed block.
- **Stack packs**: java-maven, node, python, go.
- **Rules**: core directives, security, code quality, debugging protocol, agent constraints, tech strategy, session file.
- **Workers**: explorer (Haiku), builder, reviewer, research (Sonnet), architect (Opus).
- **Skills**: scope, spec, writing-adrs, swarm-plan, swarm-execute, swarm-review, qa-engineer, land-the-plane, testing, code-check, builder, architect, autopilot, evolve, task-resume.
- **Hooks** (Node): secret guard, command guard, session start, stop check.
- **Autopilot** local and headless (GitHub Actions), with opt-in auto gates re-checked in code.
- **Evolve**: signals from escaped defects, reverts and user bug reports; proposals proven by a seeded-bug eval.
- **Tooling**: `qa-twice` for any JUnit XML runner, `agent-metrics`, `claude-cost`, statusline.
