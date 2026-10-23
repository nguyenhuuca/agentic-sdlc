# Headless Autopilot and Evolve on GitHub

Install with `npx github:nguyenhuuca/agentic-sdlc init --with autopilot,evolve` (or `update --with ...` later). Then, once per repository:

1. **Secrets** (Settings → Secrets and variables → Actions):
   - `CLAUDE_CODE_OAUTH_TOKEN`: from `claude setup-token`. Both workflows need it.
   - `AUTOPILOT_MERGE_TOKEN` (optional): a fine-grained token with contents and pull-request write on this repo. Only the auto-merge step uses it; without it, `autopilot:auto-merge` comments instead of merging. A merge made with it starts your deploy CI; one made with the job token would not.
2. **Allow Actions to create pull requests** (Settings → Actions → General → Workflow permissions).
3. **Labels**: `autopilot`, `autopilot:auto-merge`, `autopilot:auto`, `evolve`, `bug`.

## Autopilot

| You do | It does |
|--------|---------|
| Add label `autopilot` to an issue you opened | plans, reviews the plan, opens a draft PR on `autopilot/issue-<N>` (Gate 1) |
| Comment `/approve` on the PR | builds, reviews, runs QA twice, pushes to the PR branch, marks it ready (Gate 2) |
| Comment `/revise <notes>` | plans again with your notes |
| Merge the PR | your normal CI deploys it |

`autopilot:auto-merge` makes Gate 2 automatic; `autopilot:auto` makes both gates automatic. The merge script re-runs every gate itself and refuses protected paths or more than `maxLoc` changed lines. Only the repository owner can trigger runs; issue text is treated as data.

## Evolve

Runs weekly (`evolveCron` in the workflow, Monday 02:00 UTC by default) or by hand from the Actions tab. Up to three new signals per run; each becomes a PR labelled `evolve` when its eval gate passes, or an issue explaining why not. You merge or close it.

## Cost

Each job posts its cost (API list-price equivalent) on the PR. Typical: a small autopilot run $1–4, an Evolve run $1–5.
