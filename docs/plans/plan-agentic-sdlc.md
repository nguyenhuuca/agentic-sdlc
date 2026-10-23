# Plan: agentic-sdlc v1

An installable Claude Code SDLC setup: planning flow, worker agents, review/QA gates, autopilot (local + headless) and a self-improvement loop (Evolve). Built from the setup that runs in `nguyenhuuca/assessment`, with the core **written from scratch**.

Status: approved 2026-10-23. Skill names stay as in assessment; the GitHub repo is created after P1.

## Constraints

- **Clean room.** The upstream `dralgorhythm/claude-agentic-framework` has no license, so none of its text is copied. Ideas and file names may match (they are not protected); sentences, tables and examples are new. Guard: `scripts/check-clean-room.mjs` compares 10-word shingles against a local upstream checkout and CI fails on any match outside an allow list (common phrases such as "Read before writing").
- **Owner-written parts are ported, not rewritten:** autopilot, Evolve, `agent-metrics`, `claude-cost`, `session.txt` / `/task-resume`, statusline, sequence template, ADR ideas 0025/0027/0028/0029. They lose every Funny Movies detail (paths `api/` `webapp/`, `mvn`, prod URLs).
- **License:** MIT, copyright nguyenhuuca. No upstream attribution needed (nothing copied); README credits the idea.
- **Stack-neutral core.** Commands (test, build, lint, coverage, smoke) come from `sdlc.config.json` in the target repo, read at runtime by scripts and named by skills. No templating of rule text, so updates stay clean.
- Node >= 20, no npm dependencies in the installer, scripts or hooks. Hooks are Node, not bash + jq: Node is already required, a missing jq no longer turns a hook off, and CRLF cannot break them.

## Layout

```
agentic-sdlc/
  bin/agentic-sdlc.mjs        installer CLI (init | update | doctor | uninstall)
  payload/                    copied into the target repo
    .claude/{agents,skills,rules,hooks,settings.json,statusline.sh}
    scripts/                  autopilot, evolve, metrics, cost, check scripts
    .github/workflows/        autopilot.yml, agent-evolve.yml (opt-in)
    templates/artifacts/      PRD, ADR, spec, plan, sequence, postmortem ...
    evals/seeded/             empty + README
    CLAUDE.md.tmpl, AGENTS.md.tmpl, sdlc.config.json.tmpl
  packs/                      optional stack packs
    java-spring/  react-vite/ node-ts/ python/
  tests/                      node:test for installer + scripts
  docs/                       README, install, concepts, ADRs of this repo
```

## Installer (`npx github:nguyenhuuca/agentic-sdlc <cmd>`)

- `init [--packs a,b] [--with autopilot,evolve] [--dry-run]`: detects stack from manifests (pom.xml, package.json, pyproject.toml, go.mod), asks only what it cannot detect, writes `sdlc.config.json`, copies payload, merges `.claude/settings.json` (union of permissions and hooks, never removes the user's), writes `.agentic-sdlc/manifest.json` (version + sha256 of every installed file).
- `update`: overwrites a file only when its hash still equals the installed hash; a file the user edited gets `<file>.sdlc-new` and is listed. Never touches `settings.local.json`, `session.txt`, `evals/seeded/*`.
- `doctor`: checks jq/gh/node, hook executability, config commands run, dead references in rules/skills.
- `uninstall`: removes unmodified installed files only.
- Dry run prints the full change list; nothing is written without `--yes` or a confirm.

## Phases

| # | Phase | Output | Proof |
|---|-------|--------|-------|
| P0 | Scaffold | README, LICENSE, layout, CI (node test + clean-room + shellcheck + actionlint), this plan, ADR-0001 clean-room | CI green on empty payload |
| P1 | Port owner-written parts | autopilot skill + verdict + templates, `autopilot.yml`, merge/cost/autopush scripts, Evolve skill + `evolve.mjs` + `agent-metrics.mjs` + workflow, `claude-cost.mjs` + pricing, session rule + `/task-resume`, statusline; all reading `sdlc.config.json` | existing tests ported (evolve 19, metrics 36) pass; grep finds no `api/`, `webapp/`, `mvn`, `funny` |
| P2 | Core rules (new text) | `core-directives.md`, `security.md`, `code-quality.md`, `debugging-protocol.md`, `agent-constraints.md`, `tech-strategy.md` (filled by packs), `session-file.md` (ported) | clean-room check; always-loaded total <= 15 KiB (assessment: 30 KiB), held by a test |
| P3 | Worker agents (new text) | explorer (Haiku), builder (Sonnet), reviewer (Sonnet), architect (Opus), researcher (Sonnet); tools allowlists, maxTurns | autopilot dry run on a sample repo uses each |
| P4 | Core skills (new text) | `scope` (idea → PRD), `spec`, `writing-adrs`, `swarm-plan`, `swarm-execute`, `swarm-review`, `qa-engineer`, `land-the-plane`, `code-check`, `testing`, `builder`, `architect` (same names as assessment) | each skill has 2–3 evals; autopilot + evolve reference only names that exist (doctor check) |
| P5 | Hooks (new code) | secret guard (Write/Edit/Bash), dangerous command guard, session start (session.txt report), stop validator; fail-open documented | bats-style tests via node:test spawning bash, on Linux + Windows runners |
| P6 | Installer | `init/update/doctor/uninstall`, settings merge, manifest | tests on fixture repos: empty, Java, Node, already-customized settings |
| P7 | Stack packs | java-spring + react-vite (from assessment, owner-written), node-ts, python (new) | `init` on fixtures fills `sdlc.config.json` commands that run |
| P8 | Docs + release | README quick start, concepts, upgrade guide, v0.1.0 tag | fresh install on a scratch repo: `/scope` → `/autopilot` round trip |

v1 leaves out (later): swarm-research, presentation deck, threat-modeling, postmortem skill, UI/UX designer, tailor, review-steering, Claude Code plugin packaging.

## Risks

- Clean-room drift: memory of the upstream text leaks into new prose. Mitigation: the shingle check, plus writing each skill from a one-paragraph behavior brief, not from the old file.
- Autopilot/Evolve depend on core skill names and on GitHub settings (Actions may create PRs, labels). `doctor` checks both; docs list the one-time repo settings.
- Windows: hooks and scripts already hit CRLF and `jq` issues in assessment; CI runs on windows-latest too.
- Scope: 9 phases, several sessions. `session.txt` in this repo tracks the phase in flight.

## Decisions (owner, 2026-10-23)

1. v1 skill set as listed in P4; the "later" list stays later.
2. Keep the assessment names (`/swarm-plan`, `/swarm-review`, `/land-the-plane`, ...).
3. Create the public GitHub repo after P1.

## Progress

- [x] **P0** Scaffold: README, MIT, ADR-0001, CI (node test on Linux + Windows, clean-room, shellcheck, actionlint), `check-clean-room.mjs`
- [x] **P1** Owner-written parts ported:
  - `sdlc.config.json` + `scripts/sdlc/sdlc-config.mjs` (commands, limits, protected paths; defaults can only be extended)
  - autopilot skill + resources, `autopilot-{autopush-check,merge,cost}.sh`, `qa-twice.mjs` (any JUnit XML runner)
  - Evolve skill, `evolve.mjs`, `agent-metrics.mjs` (same output as the original on assessment history), evals README
  - `claude-cost.mjs` + pricing, statusline, session-file rule, `/task-resume`, sequence template
  - workflows as `*.yml.tmpl` (`deployBranch`, `setupSteps`, `allowedBash`, `evolveCron`); unattended steps read trusted copies of the helper and config
  - ADR-0002..0006 + `docs/concepts/autopilot-design.md` ported with an origin note
  - Found while porting: a PR could have changed the helper that judges it; fixed with `SDLC_HELPER` / `SDLC_CONFIG_FILE`
- [x] **P2** Core rules, new text: `core-directives`, `security`, `code-quality`, `debugging-protocol`, `agent-constraints`, `tech-strategy` (stack sections filled by packs). File names kept so ported skills still resolve; 14 KiB always loaded (assessment: 30 KiB). Tests: size limit, rule cross-references, push and security precedence present
- [x] **P3** Worker agents, new text: explorer (haiku), builder, reviewer, research (sonnet), architect (opus); no `Agent` tool, `maxTurns` on each, reviewer read-only with the Evolve section and verdict contract. Tests on structure; live check: `claude -p --agent worker-reviewer` on a seeded SQL injection returned `revise` with it as `[B]` (CWE-89), $0.07
- [x] **P4** Core skills, new text: `swarm-plan` (Artifact Requirements), `swarm-review` (severity, Root Cause Analysis, verdict block), `swarm-execute`, `qa-engineer`, `land-the-plane` (Mode A/B, retro), `core-engineering/testing`, `scope`, `spec`, `architecture/writing-adrs`, `code-check`, `builder`, `architect`; 10 artifact templates. Autopilot now lands through `land-the-plane` Mode B instead of an AGENTS.md section; `verdict.md` maps severities directly
  - Changed from the plan: per-skill evals replaced by `lib/refs.mjs`, which fails on any skill, agent, template, script, hook or rule named but missing (also the base of `doctor`). There is no skill-eval runner to make evals meaningful yet
- [x] **P5** Hooks in Node, new code: `secret-guard` (token shapes, literal secret assignments, .env writes → ask), `command-guard` (root/home deletion, force push, raw disk → deny; hard reset, rm -r, curl|sh, DROP, sudo, cat .env → ask), `session-start` (report for the person, context for the model, compaction note), `stop-check` (unpushed commits, stale session.txt; never blocks); `settings.json` with hooks, deny list and statusline. 16 tests; live check in Claude Code: `git push origin +main` (not in the deny list) was blocked by the hook and the session task reached the model's context, $0.005
- [x] **P6** Installer: `bin/agentic-sdlc.mjs` (`init`, `update`, `doctor`, `uninstall`, `--dry-run`, `--yes`, `--packs`, `--with`, `--target`), `lib/install.mjs` (plan then apply; manifest of sha256 per file, CRLF-insensitive; `.sdlc-new` for edited or pre-existing files; settings merge that only adds; managed CLAUDE.md block; .gitignore lines; config created once), `lib/doctor.mjs`, `CLAUDE.md.tmpl`. Pack format (`packs/<id>/pack.json`) in place, tested with a fixture pack. 10 tests on temp repos. Dry run on assessment: 41 existing files → `.sdlc-new`, 15 created, 3 merged, nothing written
- [x] **P7** Stack packs `java-maven` (version from the pom; Spring Boot, Liquibase, Flyway, JaCoCo rows; `src/main/resources/db/` protected), `node` (gates only for scripts that exist; Vitest or Jest + jest-junit QA; TypeScript, React, Next, Vite, Express rows), `python` (pytest; FastAPI, Django, Flask, Ruff), `go` (vet + test; gotestsum QA). Pack format gained `vars`, `qaIf`, `stackIf`. On assessment the packs produce the same gates as its hand-written setup, and `qa-twice` with that config ran 69 real tests (Maven + Vitest) twice, all pass. CI lints workflows rendered from all four packs
- [x] **P8** Docs: `docs/concepts/overview.md`, `docs/config.md` (config and pack reference), `docs/headless.md`, CHANGELOG, README; version 0.1.0. Round trip on a fresh Node + Vitest repo with a local origin: `init` from the packed tarball → `doctor` all green → `/autopilot --auto` twice (Sonnet orchestrator, $0.46 and $0.43, 2 min each): plan review and code review by separate `worker-reviewer` runs (approve, 0 blocking), `qa-twice`, auto-push check allowed, pushed with the `Autopilot-Run` trailer and run-metrics JSON; `update` in between replaced only the changed skill file
  - Fixed from run 1: `session.txt` was committed as `progress: 90, next: Gate 2 push check` and stayed so on the remote; the Land stage now writes the post-push state into the run commit (run 2: `done`, 100)
- [ ] Tag v0.1.0 (after push)

## Known Issues (v0.1.1)

- The autopilot ledger (`scratchpad/autopilot/*.md`) got only its first row in both test runs, even after the skill asked for a row after each stage and a gap check at Land. The durable record (run-metrics JSON, commit trailer) was right both times. Fix with a `scripts/sdlc/autopilot-ledger.mjs add ...` command the skill calls, instead of prose.
- `npx <path-to.tgz>` treats the path as a command and does nothing; local testing needs `npx --package=file:<tgz> agentic-sdlc ...`. Users run `npx github:...`, which is a package spec.
