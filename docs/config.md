# sdlc.config.json

`init` writes this file once from the detected stack packs. After that it is yours: `update` never touches it. Scripts read it through `node scripts/sdlc/sdlc-config.mjs`.

```json
{
  "deployBranch": "main",
  "maxLoc": 400,
  "components": [
    {
      "name": "api",
      "path": "api/",
      "gates": ["mvn -B -q -f api/pom.xml verify"],
      "qa": {
        "run": "mvn -B -q -f api/pom.xml test -Dtest={tests} -Dsurefire.failIfNoSpecifiedTests=false",
        "junit": "api/target/surefire-reports",
        "sep": ","
      }
    },
    {
      "name": "web",
      "path": "web/",
      "gates": ["npm --prefix web/. run lint", "npm --prefix web/. test", "npm --prefix web/. run build"],
      "qa": { "run": "cd web/. && npx vitest run {tests} --reporter=junit --outputFile=.qa-junit.xml", "junit": "web/.qa-junit.xml" }
    }
  ],
  "smoke": "./scripts/smoke.sh",
  "buildWorkflow": "Build and Deploy",
  "tracking": { "tasks": "TASKS.md", "status": "docs/tracking.md" },
  "extraProtectedPaths": ["^api/src/main/resources/db/"]
}
```

| Key | Default | Used by |
|-----|---------|---------|
| `deployBranch` | detected (`origin/HEAD`, else the current branch) | auto-push check, workflows, Evolve |
| `maxLoc` | 400 | changed lines outside tests and docs that auto-push or auto-merge accept (`AUTOPILOT_MAX_LOC` overrides it for one run) |
| `components[].name` | directory name | `qa-twice.mjs <name>=<tests>` |
| `components[].path` | `""` = whole repo | a change under this prefix runs the component's gates |
| `components[].gates` | from the pack | commands that must pass before a commit and before an auto-merge; none covering a change means no auto-merge |
| `components[].qa.run` | from the pack | test command; `{tests}` becomes the list joined with `sep` (default a space) |
| `components[].qa.junit` | from the pack | where that command writes JUnit XML (a file or folder inside the repo; it is deleted before each run) |
| `smoke` | `null` | read-only check after a deploy, named in the Gate 2 comment and run by `land-the-plane` |
| `buildWorkflow` | `null` | GitHub workflow name whose runs `agent-metrics` reports as build health |
| `tracking.tasks`, `tracking.status` | `TASKS.md`, `docs/tracking.md` | where skills record tasks and feature status |
| `extraProtectedPaths` | from packs | regexes added to the protected list: an unattended run that touches one is refused |
| `uncountedPaths` | tests, docs, `TASKS.md`, `session.txt` | regexes left out of `maxLoc`; setting it replaces the default list |

## Protected Paths

An auto-push or auto-merge always refuses changes to `.github/`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `scripts/sdlc/`, `sdlc.config.json` and `.env` files. `extraProtectedPaths` adds to this list; nothing removes from it. Put database migrations here: a schema change should always get a human.

In GitHub Actions the merge and cost steps read this file and its helper from the deploy branch, not from the pull request, so a PR cannot loosen its own limits.

## Stack Packs

`packs/<id>/pack.json` in this repository. `init --packs java-maven,node` picks packs by id instead of detecting them. A pack declares:

| Field | Meaning |
|-------|---------|
| `detect` | files whose presence (at the root or one directory down) selects the pack |
| `vars` | values read from a file by regex (`{ file, regex, flags, default }`), used as `@name@` |
| `component` | `gates`, `scriptGates` (npm-style: kept only for scripts that exist), `qa`, `qaIf` (first matching condition picks the runner) |
| `setupSteps`, `allowedBash` | CI setup lines and commands allowed in the headless workflow |
| `stack`, `stackIf`, `prohibited` | rows for `.claude/rules/tech-strategy.md` |
| `extraProtectedPaths`, `uncountedPaths` | added to the config |

`@dir@` is the component directory with a trailing slash (`""` at the root); `@dir@.` gives a path that also works at the root.
