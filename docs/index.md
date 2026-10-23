# agentic-sdlc

**A Claude Code setup you install into your own repository.** It turns the agent from a blank prompt into a delivery process: what to write before coding, which worker does each job, which checks must pass, and when you decide.

```bash
# see every file it would touch, then install
npx github:nguyenhuuca/agentic-sdlc init --dry-run
npx github:nguyenhuuca/agentic-sdlc init
```

<div class="grid cards" markdown>

- :material-map-marker-path: **Planning flow**

    Idea → PRD → ADR → spec + sequence diagrams → plan, scaled to the size of the change. `/scope`, `/spec`, `/swarm-plan`.

- :material-account-group: **Worker agents**

    One model per job: search on Haiku, code and review on Sonnet, architecture on Opus. Workers never start workers.

- :material-shield-check: **Gates**

    Tests first, review with a machine-read verdict, changed tests run twice, and you approve every push.

- :material-airplane-takeoff: **Autopilot**

    One small feature or fix end to end with two approval gates, locally or from a labelled GitHub issue.

- :material-sprout: **Evolve**

    The agent finds its own escaped defects, traces each to the stage that missed it, and proposes one rule change proven by a seeded-bug eval.

- :material-bookmark-check: **Session file**

    `session.txt` keeps the task in flight, so a new session or another machine continues where work stopped.

</div>

## Where to Go Next

- [Getting started](getting-started.md): install, check, first run, update.
- [How it works](concepts/overview.md): the pieces and how a change moves through them.
- [sdlc.config.json and packs](config.md): your project's commands and limits.
- [Reference](reference/rules.md): every rule, agent, skill, hook and template, generated from what `init` installs.

Stack packs: Java (Maven), Node.js (npm), Python (pytest), Go. Other stacks work with components written by hand.
