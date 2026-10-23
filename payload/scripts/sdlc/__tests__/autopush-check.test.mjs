import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SDLC = dirname(dirname(fileURLToPath(import.meta.url)))
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// A clone of a bare origin with scripts/sdlc installed and pushed, so origin/main..HEAD is the "run"
function repo(config) {
  const d = mkdtempSync(join(tmpdir(), 'push-'))
  const origin = join(d, 'origin.git')
  const work = join(d, 'work')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin])
  execFileSync('git', ['clone', '-q', origin, work], { stdio: 'ignore' })
  for (const [k, v] of [['user.name', 't'], ['user.email', 't@t'], ['core.autocrlf', 'false']]) git(work, 'config', k, v)
  git(work, 'checkout', '-q', '-b', 'main')
  cpSync(SDLC, join(work, 'scripts/sdlc'), { recursive: true, filter: (s) => !s.includes('__tests__') })
  if (config) writeFileSync(join(work, 'sdlc.config.json'), JSON.stringify(config))
  writeFileSync(join(work, 'README.md'), 'x\n')
  git(work, 'add', '-A')
  git(work, 'commit', '-q', '-m', 'init')
  git(work, 'push', '-q', 'origin', 'main')
  return work
}

function commit(work, files, msg = 'feat: x') {
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(dirname(join(work, p)), { recursive: true })
    writeFileSync(join(work, p), text)
  }
  git(work, 'add', '-A')
  git(work, 'commit', '-q', '-m', msg)
}

const check = (work, env = {}) => {
  const r = spawnSync('bash', ['scripts/sdlc/autopilot-autopush-check.sh'], { cwd: work, encoding: 'utf8', env: { ...process.env, ...env } })
  return { code: r.status, out: (r.stdout + r.stderr).trim() }
}

const lines = (n) => Array.from({ length: n }, (_, i) => `l${i}`).join('\n') + '\n'

test('a small change outside protected paths may push', () => {
  const w = repo()
  commit(w, { 'src/a.js': lines(10), 'src/__tests__/a.test.js': lines(500) })
  const r = check(w)
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /auto-push allowed: 1 commit\(s\), 10 changed lines/)
})

test('nothing ahead, a dirty tree, a protected path or too many lines refuse', () => {
  const w = repo({ extraProtectedPaths: ['^db/migrations/'], maxLoc: 20 })
  assert.match(check(w).out, /no commits ahead of origin\/main/)

  commit(w, { 'src/a.js': lines(5) })
  writeFileSync(join(w, 'README.md'), 'dirty\n')
  assert.match(check(w).out, /uncommitted changes/)
  git(w, 'checkout', '--', 'README.md')

  commit(w, { 'db/migrations/1.sql': 'drop table x;\n' })
  const p = check(w)
  assert.equal(p.code, 1)
  assert.match(p.out, /protected paths changed: db\/migrations\/1\.sql/)
})

test('the line limit counts code only and the env override wins', () => {
  const w = repo({ maxLoc: 20 })
  commit(w, { 'src/big.js': lines(30), 'docs/notes.md': lines(300) })
  assert.match(check(w).out, /30 changed lines outside tests and docs \(limit 20\)/)
  assert.equal(check(w, { AUTOPILOT_MAX_LOC: '50' }).code, 0)
})

test('a change to the framework or its config is protected even when the config says otherwise', () => {
  const w = repo({ protectedPaths: [] })
  commit(w, { 'sdlc.config.json': JSON.stringify({ maxLoc: 99999 }) })
  assert.match(check(w).out, /protected paths changed: sdlc\.config\.json/)
})
