# Changelog

## 0.1.3 (2026-10-23)

- Autopilot skill opens with a **Usage** table (request, plan file, `--auto-push`, `--auto`, headless). The flags were only in the frontmatter, which MkDocs does not render, and deep in the scope guard.
- The docs reference shows each skill's usage line under its heading.

## 0.1.2 (2026-10-23)

- **Autopilot ledger script** `scripts/sdlc/autopilot-ledger.mjs` (`start`, `add`, `note`, `check`, `total`). The skill adds a row by command after each stage instead of editing a table, and runs `check` before the landing commit. It also writes the `## Runs` rows of a headless run report. Before: two test runs left only the first row; after: a test run recorded all 9 stages.

## 0.1.1 (2026-10-23)

- Fix: on a CRLF checkout (Windows with `core.autocrlf`) the tech-strategy stack table, the managed CLAUDE.md block and block placeholders in templates were not matched. Installs through `npx github:` were not affected (npm unpacks the repo's LF files). A test now installs from a CRLF copy of the payload.

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
