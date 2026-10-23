import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { anyOf, DEFAULTS, gatesFor, get, load } from '../sdlc-config.mjs'

const repo = (cfg) => {
  const d = mkdtempSync(join(tmpdir(), 'sdlc-'))
  if (cfg) writeFileSync(join(d, 'sdlc.config.json'), JSON.stringify(cfg))
  return d
}

test('load falls back to defaults without a config file', () => {
  const cfg = load(repo())
  assert.equal(cfg.deployBranch, 'main')
  assert.equal(cfg.maxLoc, 400)
  assert.deepEqual(cfg.components, [])
})

test('extra protected paths add to the defaults, never replace them', () => {
  const cfg = load(repo({ extraProtectedPaths: ['^db/migrations/'], protectedPaths: [] }))
  const re = new RegExp(anyOf(cfg.protectedPaths))
  for (const p of ['.github/workflows/ci.yml', '.claude/settings.json', 'scripts/sdlc/evolve.mjs', 'api/.env', 'db/migrations/1.sql']) assert.ok(re.test(p), p)
  assert.ok(!re.test('src/app.js'))
  assert.ok(!re.test('scripts/build.sh'), 'app scripts stay editable')
})

test('uncounted paths skip tests, docs and tracking files', () => {
  const re = new RegExp(anyOf(DEFAULTS.uncountedPaths))
  for (const p of ['src/__tests__/a.js', 'web/a.test.jsx', 'api/src/test/A.java', 'docs/x.md', 'TASKS.md']) assert.ok(re.test(p), p)
  assert.ok(!re.test('src/main/A.java'))
})

test('gatesFor runs only the components the change touches; empty path means every change', () => {
  const cfg = load(repo({
    components: [
      { name: 'api', path: 'api/', gates: ['mvn -B -f api/pom.xml verify'] },
      { name: 'web', path: 'webapp/', gates: ['npm --prefix webapp test', 'npm --prefix webapp run build'] },
      { name: 'all', path: '', gates: ['make lint'] },
    ],
  }))
  assert.deepEqual(gatesFor(cfg, ['webapp/src/a.jsx']), ['npm --prefix webapp test', 'npm --prefix webapp run build', 'make lint'])
  assert.deepEqual(gatesFor(cfg, ['README.md']), ['make lint'])
  assert.equal(get(cfg, 'tracking.tasks'), 'TASKS.md')
  assert.equal(get(cfg, 'no.such.key'), undefined)
})

test('an explicit config file wins over the checkout one (trusted copy for unattended jobs)', () => {
  const pr = repo({ maxLoc: 99999 })
  const trusted = join(repo({ maxLoc: 50 }), 'sdlc.config.json')
  assert.equal(load(pr, trusted).maxLoc, 50)
})
