// Finds references inside an installed (or payload) tree that point at nothing: skills, agents, templates, scripts,
// hooks and rules named in markdown and scripts. Used by tests on payload/ and by `agentic-sdlc doctor` on a repo.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SCAN = ['.claude', 'scripts/sdlc', 'templates', 'evals']
const TEXT = /\.(md|mjs|sh|json|tmpl)$/

function* files(root, dir) {
  const abs = join(root, dir)
  if (!existsSync(abs)) return
  for (const e of readdirSync(abs)) {
    const rel = join(dir, e)
    if (statSync(join(root, rel)).isDirectory()) { if (e !== '__tests__') yield* files(root, rel) } else if (TEXT.test(e)) yield rel
  }
}

// The kinds of path this framework names; each must exist relative to the root
const PATTERNS = [
  /\.claude\/skills\/[\w./-]+?\/SKILL\.md/g,
  /\.claude\/skills\/[\w-]+\/resources\/[\w.-]+\.(?:md|json)/g,
  /\.claude\/agents\/[\w-]+\.md/g,
  /\.claude\/hooks\/[\w-]+\.sh/g,
  /\.claude\/rules\/[\w-]+\.md/g,
  /templates\/artifacts\/[\w-]+\.template\.md/g,
  /scripts\/sdlc\/[\w-]+\.(?:mjs|sh|json)/g,
]
const AGENT = /\bworker-[a-z]+\b/g

export function skillNames(root) {
  const out = new Map()
  for (const f of files(root, '.claude/skills')) {
    if (!f.endsWith('SKILL.md')) continue
    const name = /^name:\s*(.+)$/m.exec(readFileSync(join(root, f), 'utf8'))?.[1]?.trim()
    if (name) out.set(name, f.replaceAll('\\', '/'))
  }
  return out
}

export function brokenRefs(root, { ignore = [] } = {}) {
  const missing = []
  const agents = new Set(existsSync(join(root, '.claude/agents'))
    ? readdirSync(join(root, '.claude/agents')).map((f) => f.replace(/\.md$/, '')) : [])
  for (const f of files(root, '')) {
    const rel = relative(root, join(root, f)).replaceAll('\\', '/')
    if (!SCAN.some((d) => rel.startsWith(d))) continue
    const text = readFileSync(join(root, f), 'utf8')
    for (const re of PATTERNS) {
      for (const [p] of text.matchAll(re)) {
        if (p.includes('<') || ignore.includes(p) || existsSync(join(root, p))) continue
        missing.push({ file: rel, ref: p })
      }
    }
    for (const [a] of text.matchAll(AGENT)) {
      if (!agents.has(a) && !ignore.includes(a)) missing.push({ file: rel, ref: a })
    }
  }
  return missing
}
