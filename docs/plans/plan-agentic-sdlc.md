# Plan: agentic-sdlc v1

An installable Claude Code SDLC setup: planning flow, worker agents, review/QA gates, autopilot (local + headless) and a self-improvement loop (Evolve). Built from the setup that runs in `nguyenhuuca/assessment`, with the core **written from scratch**.

Status: approved 2026-10-23. Skill names stay as in assessment; the GitHub repo is created after P1.

## Constraints

- **Clean room.** The upstream `dralgorhythm/claude-agentic-framework` has no license, so none of its text is copied. Ideas and file names may match (they are not protected); sentences, tables and examples are new. Guard: `scripts/check-clean-room.mjs` compares 10-word shingles against a local upstream checkout and CI fails on any match outside an allow list (common phrases such as "Read before writing").
- **Owner-written parts are ported, not rewritten:** autopilot, Evolve, `agent-metrics`, `claude-cost`, `session.txt` / `/task-resume`, statusline, sequence template, ADR ideas 0025/0027/0028/0029. They lose every Funny Movies detail (paths `api/` `webapp/`, `mvn`, prod URLs).
- **License:** MIT, copyright nguyenhuuca. No upstream attribution needed (nothing copied); README credits the idea.
- **Stack-neutral core.** Commands (test, build, lint, coverage, smoke) come from `sdlc.config.json` in the target repo, read at runtime by scripts and named by skills. No templating of rule text, so updates stay clean.
- Node >= 20, no npm dependencies in the installer or scripts. Bash for hooks (with the Windows Git Bash fixes already learned).

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
- [ ] **P4** Core skills (new text), plus the artifact templates the agents and skills name (`templates/artifacts/`: adr, prd, pr_faq, spec, design_spec, plan, roadmap, postmortem, security_audit, system_design)
