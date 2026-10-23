import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, buildConfig, detect, mergeSettings, planInstall, planUninstall, readManifest, summarize } from '../lib/install.mjs'
import { doctor } from '../lib/doctor.mjs'
import { parseArgs } from '../lib/cli.mjs'

const PAYLOAD = 'payload'
const PACK = {
  id: 'fake-node',
  detect: ['package.json'],
  component: { scriptGates: { test: 'npm --prefix @dir@ test', lint: 'npm --prefix @dir@ run lint', build: 'npm --prefix @dir@ run build' },
    qa: { run: 'npx --prefix @dir@ vitest run {tests} --reporter=junit --outputFile=@dir@junit.xml', junit: '@dir@junit.xml' } },
  setupSteps: [['- uses: actions/setup-node@v4', '  with:', "    node-version: '20'"]],
  allowedBash: ['npm', 'npx'],
  stack: [['Language', 'JavaScript'], ['Test', 'Vitest']],
  prohibited: ['No default exports in new modules'],
  extraProtectedPaths: ['^@dir@migrations/'],
}

function repo() {
  const root = mkdtempSync(join(tmpdir(), 'inst-'))
  execFileSync('git', ['init', '-q', '-b', 'main', root])
  mkdirSync(join(root, 'web'))
  writeFileSync(join(root, 'web/package.json'), JSON.stringify({ scripts: { test: 'vitest', build: 'vite build' } }))
  return root
}

const install = (root, { payload = PAYLOAD, workflows = [], mode } = {}) => {
  const hits = detect(root, [PACK])
  const cfg = buildConfig(root, hits)
  const plan = planInstall(root, payload, { mode: mode ?? (readManifest(root) ? 'update' : 'init'), hits, cfg, version: '0.1.0', workflows })
  apply(root, plan)
  return plan
}
const ops = (plan) => Object.fromEntries(plan.actions.map((a) => [a.path, a.op]))
const read = (root, p) => readFileSync(join(root, p), 'utf8')

test('detect finds a pack one level down and builds the component from its scripts', () => {
  const root = repo()
  const hits = detect(root, [PACK])
  assert.deepEqual(hits.map((h) => [h.dir, h.evidence]), [['web/', 'web/package.json']])
  const cfg = buildConfig(root, hits)
  assert.equal(cfg.deployBranch, 'main')
  assert.deepEqual(cfg.components, [{
    name: 'web', path: 'web/', gates: ['npm --prefix web/ test', 'npm --prefix web/ run build'],
    qa: { run: 'npx --prefix web/ vitest run {tests} --reporter=junit --outputFile=web/junit.xml', junit: 'web/junit.xml' },
  }])
  assert.deepEqual(cfg.extraProtectedPaths, ['^web/migrations/'])
})

test('init installs the payload, merges shared files and records a manifest', () => {
  const root = repo()
  writeFileSync(join(root, 'CLAUDE.md'), '# My project\n\nRun with make.\n')
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n')
  install(root)
  for (const p of ['.claude/rules/security.md', '.claude/agents/worker-reviewer.md', '.claude/hooks/command-guard.mjs', 'scripts/sdlc/qa-twice.mjs', 'templates/artifacts/adr.template.md']) {
    assert.ok(existsSync(join(root, p)), p)
  }
  assert.ok(!existsSync(join(root, 'scripts/sdlc/__tests__')), 'tests are not installed')
  assert.ok(!existsSync(join(root, '.github/workflows')), 'workflows only with --with')
  assert.match(read(root, 'CLAUDE.md'), /^# My project\n\nRun with make\.\n\n<!-- agentic-sdlc:begin/)
  assert.match(read(root, '.gitignore'), /node_modules\/\n\n# agentic-sdlc\nscratchpad\/\n/)
  assert.match(read(root, '.claude/rules/tech-strategy.md'), /\| Language \| JavaScript \(`web\/`\) \|/)
  assert.match(read(root, '.claude/rules/tech-strategy.md'), /- No default exports in new modules/)
  assert.equal(JSON.parse(read(root, 'sdlc.config.json')).components[0].name, 'web')
  const m = readManifest(root)
  assert.equal(m.version, '0.1.0')
  assert.ok(m.files['.claude/rules/security.md'])
  assert.ok(!('sdlc.config.json' in m.files) && !('CLAUDE.md' in m.files), 'merged files are not owned')
})

test('a second run changes nothing', () => {
  const root = repo()
  install(root)
  const again = install(root)
  assert.deepEqual(summarize(again), [])
})

test('update: refreshes untouched files, keeps the repo\'s edits, honors deletions, drops files no longer shipped', () => {
  const root = repo()
  const v1 = mkdtempSync(join(tmpdir(), 'pay1-'))
  cpSync(PAYLOAD, v1, { recursive: true })
  writeFileSync(join(v1, '.claude/rules/old-rule.md'), 'old\n')
  install(root, { payload: v1 })
  writeFileSync(join(root, '.claude/rules/code-quality.md'), 'my own rules\n')        // edited by the repo
  rmSync(join(root, '.claude/agents/worker-research.md'))                              // deleted by the repo
  const v2 = mkdtempSync(join(tmpdir(), 'pay2-'))
  cpSync(v1, v2, { recursive: true })
  rmSync(join(v2, '.claude/rules/old-rule.md'))
  for (const f of ['.claude/rules/security.md', '.claude/rules/code-quality.md']) writeFileSync(join(v2, f), `${read(v2, f)}\nNew line in v2.\n`)
  const plan = install(root, { payload: v2 })
  const o = ops(plan)
  assert.equal(o['.claude/rules/security.md'], 'update')
  assert.equal(o['.claude/rules/code-quality.md'], 'sdlc-new')
  assert.equal(o['.claude/agents/worker-research.md'], 'keep')
  assert.equal(o['.claude/rules/old-rule.md'], 'delete')
  assert.match(read(root, '.claude/rules/security.md'), /New line in v2/)
  assert.equal(read(root, '.claude/rules/code-quality.md'), 'my own rules\n')
  assert.match(read(root, '.claude/rules/code-quality.md.sdlc-new'), /New line in v2/)
  assert.ok(!existsSync(join(root, '.claude/agents/worker-research.md')))
  assert.ok(!existsSync(join(root, '.claude/rules/old-rule.md')))
})

test('a file that existed before install is never overwritten', () => {
  const root = repo()
  mkdirSync(join(root, '.claude/rules'), { recursive: true })
  writeFileSync(join(root, '.claude/rules/security.md'), 'ours\n')
  const plan = install(root)
  assert.equal(ops(plan)['.claude/rules/security.md'], 'sdlc-new')
  assert.equal(read(root, '.claude/rules/security.md'), 'ours\n')
})

test('settings merge adds ours, keeps theirs; uninstall removes ours only', () => {
  const root = repo()
  mkdirSync(join(root, '.claude'), { recursive: true })
  const theirs = { permissions: { allow: ['Bash(make:*)'], deny: ['Read(./private/**)'] }, hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo bye' }] }] }, model: 'opus' }
  writeFileSync(join(root, '.claude/settings.json'), JSON.stringify(theirs))
  writeFileSync(join(root, 'CLAUDE.md'), '# Mine\n')
  install(root)
  const s = JSON.parse(read(root, '.claude/settings.json'))
  assert.deepEqual(s.permissions.allow, ['Bash(make:*)'])
  assert.ok(s.permissions.deny.includes('Read(./private/**)') && s.permissions.deny.includes('Read(**/.env)'))
  assert.equal(s.model, 'opus')
  assert.equal(s.hooks.Stop.length, 2)
  assert.ok(s.hooks.PreToolUse.some((g) => g.hooks.some((h) => h.command.includes('command-guard.mjs'))))

  writeFileSync(join(root, '.claude/rules/debugging-protocol.md'), 'kept because edited\n')
  apply(root, planUninstall(root, PAYLOAD))
  const after = JSON.parse(read(root, '.claude/settings.json'))
  assert.deepEqual(after.hooks, { Stop: [{ hooks: [{ type: 'command', command: 'echo bye' }] }] })
  assert.ok(after.permissions.deny.includes('Read(**/.env)'), 'deny rules stay')
  assert.equal(after.statusLine, undefined)
  assert.equal(read(root, 'CLAUDE.md'), '# Mine\n')
  assert.ok(!existsSync(join(root, '.claude/rules/security.md')))
  assert.equal(read(root, '.claude/rules/debugging-protocol.md'), 'kept because edited\n')
  assert.ok(!existsSync(join(root, '.agentic-sdlc/manifest.json')))
})

test('mergeSettings is idempotent', () => {
  const ours = JSON.parse(read(PAYLOAD, '.claude/settings.json'))
  const once = mergeSettings({}, ours)
  assert.deepEqual(mergeSettings(once, ours), once)
})

test('--with autopilot,evolve renders both workflows from the packs', () => {
  const root = repo()
  install(root, { workflows: ['autopilot', 'evolve'] })
  const ap = read(root, '.github/workflows/autopilot.yml')
  assert.ok(!/\{\{\w+\}\}/.test(ap))
  assert.match(ap, /- uses: actions\/setup-node@v4\n {8}with:\n {10}node-version: '20'/)
  assert.match(ap, /Bash\(node:\*\),Bash\(npm:\*\),Bash\(npx:\*\),Bash\(cd:\*\)/)
  assert.ok(existsSync(join(root, '.github/workflows/agent-evolve.yml')))
  assert.deepEqual(readManifest(root).workflows, ['autopilot', 'evolve'])
})

test('doctor: a fresh install has no failures', () => {
  const root = repo()
  install(root)
  const checks = doctor(root, PAYLOAD, { tools: () => true })
  assert.deepEqual(checks.filter((c) => c.level === 'fail'), [])
  assert.ok(checks.some((c) => c.label === 'hooks wired' && c.level === 'ok'))
  assert.ok(checks.some((c) => c.label === 'references resolve' && c.level === 'ok'))
  writeFileSync(join(root, '.claude/rules/x.md'), 'see `.claude/skills/nope/SKILL.md`\n')
  assert.ok(doctor(root, PAYLOAD, { tools: () => true }).some((c) => c.label === 'references resolve' && c.level === 'fail'))
})

test('CLI: options, dry run writes nothing, no terminal needs --yes', () => {
  assert.throws(() => parseArgs(['deploy']), /command/)
  assert.throws(() => parseArgs(['init', '--with', 'nope']), /--with knows/)
  assert.deepEqual(parseArgs(['init', '--packs', 'a,b', '--yes']).packs, ['a', 'b'])
  const root = repo()
  const cli = (...args) => spawnSync(process.execPath, ['bin/agentic-sdlc.mjs', ...args, '--target', root], { encoding: 'utf8' })
  const dry = cli('init', '--dry-run')
  assert.equal(dry.status, 0)
  assert.match(dry.stdout, /create {3}\.claude\/rules\/security\.md/)
  assert.ok(!existsSync(join(root, '.claude')))
  const noTty = cli('init')
  assert.equal(noTty.status, 1)
  assert.match(noTty.stdout, /pass --yes/)
  assert.ok(!existsSync(join(root, '.claude')))
  assert.equal(cli('init', '--yes').status, 0)
  assert.equal(cli('doctor').status, 0, cli('doctor').stdout)
})

test('the published package carries everything the CLI imports, and the bin always runs', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  for (const dir of ['bin', 'lib', 'payload', 'packs']) assert.ok(pkg.files.includes(dir), `package.json files misses ${dir}`)
  for (const f of ['bin/agentic-sdlc.mjs', 'lib/cli.mjs', 'lib/install.mjs']) {
    for (const [, spec] of readFileSync(f, 'utf8').matchAll(/from '(\.\.?\/[^']+)'/g)) {
      const top = join(f, '..', spec).split(/[\\/]/)[0]
      assert.ok(pkg.files.includes(top), `${f} imports ${spec} outside the published files`)
    }
  }
  // npx reaches the bin through a .bin shim, so argv[1] is not this file: a main-module guard would skip main()
  assert.ok(!/import\.meta\.url/.test(readFileSync('bin/agentic-sdlc.mjs', 'utf8')), 'bin must not guard main()')
})
