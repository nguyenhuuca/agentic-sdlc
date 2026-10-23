#!/usr/bin/env node
// Generates docs/reference/*.md from payload/ so the site shows exactly what `init` installs.
// The output is git-ignored; CI runs this before `mkdocs build`. Usage: node scripts/build-docs-reference.mjs
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPacks } from '../lib/install.mjs'

const P = 'payload'
const OUT = 'docs/reference'
const BLOB = 'https://github.com/nguyenhuuca/agentic-sdlc/blob/main'

export function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!m) return { meta: {}, body: text }
  const meta = Object.fromEntries(m[1].split(/\r?\n/).map((l) => l.match(/^([\w-]+):\s*(.*)$/)).filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^"(.*)"$/, '$1')]))
  return { meta, body: text.slice(m[0].length) }
}

// Every heading one level down, so a file's own "# Title" sits under the page title
export const demote = (body) => body.replace(/^(#{1,5}) /gm, '#$1 ').replace(/```[\s\S]*?```/g, (block) => block.replace(/^#(#{1,6}) /gm, '$1 '))

const md = (s) => String(s ?? '').replace(/\|/g, '\\|')
// Inside a table cell: entities, so neither Markdown nor the cell splitter touches <, >, | or --
const htmlCode = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '&#124;')
const source = (path) => `[\`${path}\`](${BLOB}/payload/${path})`

function* files(dir, test) {
  for (const e of readdirSync(join(P, dir)).sort()) {
    const rel = `${dir}/${e}`
    if (statSync(join(P, rel)).isDirectory()) { if (e !== '__tests__') yield* files(rel, test) } else if (test(rel)) yield rel
  }
}

function section(path, title, intro) {
  const { body } = frontmatter(readFileSync(join(P, path), 'utf8'))
  const withoutTitle = body.trimStart().replace(/^# .*\r?\n+/, '')
  return [`## ${title}`, '', intro ? `${intro}\n` : '', `Source: ${source(path)}`, '', demote(withoutTitle).trim(), ''].join('\n')
}

export function rulesPage() {
  const rules = [...files('.claude/rules', (f) => f.endsWith('.md'))]
  const head = ['# Rules', '', 'Loaded into every session (`.claude/rules/`). Each section below is the installed file.', '',
    '| File | First line |', '|------|-----------|',
    ...rules.map((r) => `| [\`${basename(r)}\`](#${basename(r, '.md')}) | ${md(frontmatter(readFileSync(join(P, r), 'utf8')).body.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#')))} |`), '']
  return [...head, ...rules.map((r) => section(r, basename(r, '.md')))].join('\n')
}

export function agentsPage() {
  const agents = [...files('.claude/agents', (f) => f.endsWith('.md'))]
  const meta = agents.map((a) => ({ a, ...frontmatter(readFileSync(join(P, a), 'utf8')).meta }))
  return ['# Worker Agents', '', 'Started by the orchestrator or a skill; never by another worker (`.claude/agents/`).', '',
    '| Agent | Model | Tools | Max turns | Use |', '|-------|-------|-------|-----------|-----|',
    ...meta.map((m) => `| [\`${m.name}\`](#${m.name}) | ${m.model} | ${md(m.tools)} | ${m.maxTurns} | ${md(m.description)} |`), '',
    ...meta.map((m) => section(m.a, m.name)),
  ].join('\n')
}

export function skillsPage() {
  const skills = [...files('.claude/skills', (f) => f.endsWith('/SKILL.md'))]
  const meta = skills.map((s) => ({ s, ...frontmatter(readFileSync(join(P, s), 'utf8')).meta }))
    .sort((x, y) => x.name.localeCompare(y.name))
  const how = (m) => (m['disable-model-invocation'] === 'true' ? `you: \`/${m.name}\`` : m['disable-model-invocation'] === 'false' ? `you or a workflow: \`/${m.name}\`` : 'loaded when relevant')
  return ['# Skills', '', 'Workflows and know-how in `.claude/skills/`.', '',
    '| Skill | Invoked by | Arguments | What it does |', '|-------|-----------|-----------|--------------|',
    ...meta.map((m) => `| [\`${m.name}\`](#${m.name}) | ${how(m)} | ${m['argument-hint'] ? `<code>${htmlCode(m['argument-hint'])}</code>` : ''} | ${md(m.description)} |`), '',
    // MkDocs drops the frontmatter, so the usage line from argument-hint is repeated under each heading
    ...meta.map((m) => section(m.s, m.name, m['disable-model-invocation'] !== undefined
      ? `**Usage:** <code>/${m.name}${m['argument-hint'] ? ` ${htmlCode(m['argument-hint'])}` : ''}</code>` : '')),
  ].join('\n')
}

export function hooksPage() {
  const settings = JSON.parse(readFileSync(join(P, '.claude/settings.json'), 'utf8'))
  const events = Object.entries(settings.hooks).flatMap(([event, groups]) => groups.flatMap((g) => g.hooks.map((h) => ({
    event, matcher: g.matcher ?? '*', file: /hooks\/([\w-]+\.mjs)/.exec(h.command)?.[1],
  }))))
  const doc = (f) => readFileSync(join(P, '.claude/hooks', f), 'utf8').split(/\r?\n/).filter((l) => l.startsWith('//')).map((l) => l.replace(/^\/\/ ?/, '')).join(' ')
  return ['# Hooks and Permissions', '', 'Wired in `.claude/settings.json`. Hooks are guardrails that ask or deny on known patterns; `permissions.deny` is the hard boundary (see `security.md`).', '',
    '| Event | Matcher | Hook | What it does |', '|-------|---------|------|--------------|',
    ...events.map((e) => `| ${e.event} | \`${md(e.matcher)}\` | ${source(`.claude/hooks/${e.file}`)} | ${md(doc(e.file))} |`), '',
    '## Denied Permissions', '', 'Claude Code refuses these whatever any allow rule says:', '',
    ...settings.permissions.deny.map((d) => `- \`${d}\``), '',
  ].join('\n')
}

export function templatesPage() {
  const ts = [...files('templates/artifacts', (f) => f.endsWith('.md'))]
  return ['# Artifact Templates', '', 'Starting points in `templates/artifacts/`, used by `/scope`, `/spec`, `/swarm-plan` and the workers.', '',
    ...ts.flatMap((t) => [`## ${basename(t, '.template.md').replaceAll('_', ' ')}`, '', `Source: ${source(t)}`, '', '````markdown', readFileSync(join(P, t), 'utf8').trim(), '````', '']),
  ].join('\n')
}

export function packsPage() {
  const packs = loadPacks('packs')
  const cell = (xs) => md((xs ?? []).map((x) => `\`${x}\``).join(', '))
  return ['# Stack Packs', '', 'Detected by `init` from build files at the repository root or one directory down. Format: [sdlc.config.json and packs](../config.md#stack-packs).', '',
    '| Pack | Detects | Gates | QA runner | Commands allowed in CI |', '|------|---------|-------|-----------|------------------------|',
    ...packs.map((p) => {
      const c = p.component ?? {}
      const gates = c.gates ?? Object.values(c.scriptGates ?? {})
      const qa = c.qa ? 'yes' : c.qaIf ? `by dependency (${c.qaIf.length})` : 'none'
      return `| [\`${p.id}\`](${BLOB}/packs/${p.id}/pack.json) ${md(p.name)} | ${cell(p.detect)} | ${cell(gates)} | ${qa} | ${cell(p.allowedBash)} |`
    }), '',
    '`@dir@` is the component directory, for example `api/`.', '',
  ].join('\n')
}

export function build(out = OUT) {
  mkdirSync(out, { recursive: true })
  const pages = { 'rules.md': rulesPage(), 'agents.md': agentsPage(), 'skills.md': skillsPage(), 'hooks.md': hooksPage(), 'templates.md': templatesPage(), 'packs.md': packsPage() }
  for (const [f, text] of Object.entries(pages)) writeFileSync(join(out, f), text)
  return Object.keys(pages)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(build().map((f) => `${OUT}/${f}`).join('\n'))
