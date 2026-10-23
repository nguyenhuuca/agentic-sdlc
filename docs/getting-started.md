# Getting Started

## Requirements

- Node.js 20 or newer, git, and [Claude Code](https://code.claude.com/docs).
- Optional: the `gh` CLI (autopilot on GitHub, Evolve, metrics) and a GitHub repository.

## Install

From the root of your repository:

```bash
npx github:nguyenhuuca/agentic-sdlc init --dry-run
```

The dry run lists every action:

| Action | Meaning |
|--------|---------|
| `create` | a new file |
| `merge` | `.claude/settings.json` (hooks and deny rules added, yours kept), a marked block in `CLAUDE.md`, a few `.gitignore` lines |
| `sdlc-new` | a file that already exists: it stays as it is, and ours is written next to it as `<file>.sdlc-new` |

When the list looks right, run it for real. It asks before writing; in a script, add `--yes`.

```bash
npx github:nguyenhuuca/agentic-sdlc init
```

!!! tip "Choosing stack packs"
    `init` detects packs from build files at the root and one directory down (`pom.xml`, `package.json`, `pyproject.toml`, `go.mod`). Use `--packs java-maven,node` to choose them yourself. The detected commands land in `sdlc.config.json`; read it before your first run.

## Check

```bash
npx github:nguyenhuuca/agentic-sdlc doctor
```

`doctor` checks Node, git, the hook wiring, `sdlc.config.json` (every component has gates and a QA runner), that every skill, agent and template named in the setup exists, and the `gh` and `claude` CLIs. Commit what `init` wrote, including `.agentic-sdlc/manifest.json`.

## First Session: Confirm the Tech Strategy

`.claude/rules/tech-strategy.md` is your golden path: every rule, skill and worker builds with what it lists. `init` fills it from the stack packs, but build files do not say everything (database, migrations, deployment, what is not allowed), so the first Claude Code session asks you to confirm it:

1. On start you see: *"👋 agentic-sdlc is installed. The tech strategy (your golden path) is not confirmed yet…"*
2. Whatever your first message is, Claude runs `/welcome` before it: it shows what was detected, with the file each claim comes from, and what it could not find.
3. It asks about the gaps with a suggestion marked *Recommended* that fits your stack, a couple of alternatives, and **Not decided yet** when you do not know.
4. It writes the answers into `tech-strategy.md` (and any gate changes into `sdlc.config.json`), marks it confirmed, and goes back to your first message.

You can say **Skip for now** (asked again next session) or **Don't ask again** (`doctor` keeps a reminder). Run `/welcome --recheck` any time to revisit it. Headless runs (`claude -p`, CI) never stop for this.

## First Run

Open Claude Code in the repository and try a small change:

```text
/autopilot Add a --verbose flag to the export command that prints each file it writes
```

It plans, has a separate reviewer check the plan, and stops at **Gate 1** for your approval. Then it implements, reviews the code, runs the changed tests twice, commits, and stops at **Gate 2** before pushing. For bigger work, start with `/scope`.

Other commands to know:

| Command | Use |
|---------|-----|
| `/swarm-review` | deep review of your current diff |
| `/code-check` | quick check before a commit |
| `/land-the-plane` | gates → commit → push (you approve) → CI |
| `/task-resume` | continue the task in `session.txt` |

## Update and Remove

```bash
npx github:nguyenhuuca/agentic-sdlc update      # refreshes files you have not edited
npx github:nguyenhuuca/agentic-sdlc uninstall   # removes unedited files and our hooks
```

`update` never overwrites a file you changed: it writes `<file>.sdlc-new`, and `doctor` lists the ones waiting. Files you deleted are not restored. `sdlc.config.json` is never touched after `init`.

`uninstall` keeps every file you edited and the deny rules in `settings.json`, since removing protection is the riskier mistake.

## On GitHub

To run autopilot from issues and Evolve weekly, add `--with autopilot,evolve` and follow [Autopilot and Evolve on GitHub](headless.md).
