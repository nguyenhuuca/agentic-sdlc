import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'payload/.claude/agents'
const agents = readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => {
  const text = readFileSync(join(DIR, f), 'utf8')
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? ''
  const meta = Object.fromEntries(fm.split(/\r?\n/).map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]))
  return { file: f, text, meta, tools: (meta.tools ?? '').split(',').map((t) => t.trim()).filter(Boolean) }
})
const byName = Object.fromEntries(agents.map((a) => [a.meta.name, a]))

test('the five workers exist, named after their files', () => {
  assert.deepEqual(Object.keys(byName).sort(), ['worker-architect', 'worker-builder', 'worker-explorer', 'worker-research', 'worker-reviewer'])
  for (const a of agents) {
    assert.equal(`${a.meta.name}.md`, a.file)
    assert.ok(a.meta.description?.length > 40, `${a.file}: description`)
    assert.ok(Number(a.meta.maxTurns) > 0, `${a.file}: maxTurns`)
  }
})

test('model per job: search on haiku, architecture on opus, the rest on sonnet', () => {
  assert.deepEqual(Object.fromEntries(agents.map((a) => [a.meta.name, a.meta.model])), {
    'worker-architect': 'opus', 'worker-builder': 'sonnet', 'worker-explorer': 'haiku', 'worker-research': 'sonnet', 'worker-reviewer': 'sonnet',
  })
})

test('no worker can start a worker; read-only workers cannot write', () => {
  for (const a of agents) assert.ok(!a.tools.includes('Agent'), `${a.file} has Agent`)
  for (const n of ['worker-reviewer', 'worker-explorer']) {
    assert.ok(!byName[n].tools.some((t) => ['Write', 'Edit', 'NotebookEdit'].includes(t)), `${n} can write`)
  }
})

test('the reviewer keeps the contract Evolve and autopilot rely on', () => {
  const r = byName['worker-reviewer'].text
  assert.match(r, /^## Checks Learned From Escaped Defects$/m)
  assert.match(r, /\.claude\/skills\/autopilot\/resources\/verdict\.md/)
  assert.match(r, /VERDICT: approve \| revise/)
})
