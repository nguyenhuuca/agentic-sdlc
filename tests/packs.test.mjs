import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { buildConfig, detect, fillTechStrategy, loadPacks, workflowVars } from '../lib/install.mjs'
import { render } from '../lib/render.mjs'

const PACKS = loadPacks('packs')
const TECH = readFileSync('payload/.claude/rules/tech-strategy.md', 'utf8')

function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'pack-'))
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true })
    writeFileSync(join(root, p), text)
  }
  return root
}
const setup = (files) => {
  const root = repo(files)
  const hits = detect(root, PACKS)
  return { root, hits, cfg: buildConfig(root, hits), tech: fillTechStrategy(TECH, hits, root) }
}

test('four packs ship, each with detect files, gates and a stack', () => {
  assert.deepEqual(PACKS.map((p) => p.id).sort(), ['go', 'java-maven', 'node', 'python'])
  for (const p of PACKS) {
    assert.ok(p.detect?.length, p.id)
    assert.ok(p.component?.gates?.length || p.component?.scriptGates, p.id)
    assert.ok(p.stack?.length, p.id)
    assert.ok(p.setupSteps?.length && p.allowedBash?.length, p.id)
  }
})

test('java-maven: version from the pom, Spring and Liquibase rows, migrations protected', () => {
  const pom = '<project><properties><java.version>17</java.version></properties>spring-boot-starter liquibase-core</project>'
  const { hits, cfg, tech } = setup({ 'api/pom.xml': pom })
  assert.deepEqual(cfg.components, [{
    name: 'api', path: 'api/', gates: ['mvn -B -q -f api/pom.xml verify'],
    qa: { run: 'mvn -B -q -f api/pom.xml test -Dtest={tests} -Dsurefire.failIfNoSpecifiedTests=false -Djacoco.skip=true', junit: 'api/target/surefire-reports', sep: ',' },
  }])
  assert.deepEqual(cfg.extraProtectedPaths, ['^api/src/main/resources/db/'])
  assert.match(tech, /\| Language \| Java 17 \(`api\/`\) \|/)
  assert.match(tech, /\| Framework \| Spring Boot/)
  assert.match(tech, /\| Migrations \| Liquibase/)
  assert.ok(workflowVars(hits, cfg).setupSteps.includes("    java-version: '17'"))
})

test('node: gates only for scripts that exist, vitest QA, stack from dependencies', () => {
  const pkg = { engines: { node: '>=22' }, scripts: { test: 'vitest', build: 'vite build' }, devDependencies: { vitest: '1', typescript: '5', vite: '6' }, dependencies: { react: '19' } }
  const { cfg, tech, hits } = setup({ 'package.json': JSON.stringify(pkg) })
  const c = cfg.components[0]
  assert.deepEqual([c.name, c.path, c.gates], ['node', '', ['npm --prefix . test', 'npm --prefix . run build']])
  assert.equal(c.qa.run, 'cd . && npx vitest run {tests} --reporter=junit --outputFile=.qa-junit.xml')
  assert.equal(c.qa.junit, '.qa-junit.xml')
  for (const row of ['Node.js 22', 'TypeScript', 'React', 'Vite', 'Vitest']) assert.ok(tech.includes(row), row)
  assert.ok(!tech.includes('Jest'))
  assert.ok(workflowVars(hits, cfg).setupSteps.includes('- run: npm ci --prefix .'))
})

test('node: jest without jest-junit gets no QA runner (doctor warns), jest-junit gets one', () => {
  const without = setup({ 'package.json': JSON.stringify({ scripts: { test: 'jest' }, devDependencies: { jest: '29' } }) })
  assert.equal(without.cfg.components[0].qa, undefined)
  const withJunit = setup({ 'package.json': JSON.stringify({ scripts: { test: 'jest' }, devDependencies: { jest: '29', 'jest-junit': '16' } }) })
  assert.match(withJunit.cfg.components[0].qa.run, /JEST_JUNIT_OUTPUT_FILE=\.qa-junit\.xml npx jest --ci --reporters=jest-junit \{tests\}/)
})

test('python: requires-python sets the version; framework rows from pyproject or requirements', () => {
  const a = setup({ 'svc/pyproject.toml': '[project]\nrequires-python = ">=3.11"\ndependencies = ["fastapi"]\n[tool.ruff]\n' })
  assert.deepEqual(a.cfg.components[0].gates, ['python -m pytest -q svc/.'])
  assert.equal(a.cfg.components[0].qa.junit, 'svc/.qa-junit.xml')
  for (const row of ['Python 3.11', 'FastAPI', 'Ruff']) assert.ok(a.tech.includes(row), row)
  const b = setup({ 'requirements.txt': 'django==5\n' })
  assert.ok(b.tech.includes('Django') && b.tech.includes('Python 3.12'))
})

test('go: version from go.mod, vet and test gates, gotestsum QA', () => {
  const { cfg, tech } = setup({ 'go.mod': 'module example.com/x\n\ngo 1.23\n' })
  assert.deepEqual(cfg.components[0].gates, ['go -C . vet ./...', 'go -C . test ./...'])
  assert.equal(cfg.components[0].qa.sep, '|')
  assert.ok(tech.includes('Go 1.23'))
})

test('a Java + React repo renders an autopilot workflow with both toolchains', () => {
  const { hits, cfg } = setup({
    'api/pom.xml': '<project><java.version>21</java.version></project>',
    'webapp/package.json': JSON.stringify({ scripts: { test: 'vitest', lint: 'eslint .' }, devDependencies: { vitest: '1' } }),
  })
  const y = render(readFileSync('payload/.github/workflows/autopilot.yml.tmpl', 'utf8'), workflowVars(hits, cfg, '0.1.0'))
  assert.match(y, /uses: actions\/setup-java@v4[\s\S]*uses: actions\/setup-node@v4[\s\S]*npm ci --prefix webapp\/\./)
  assert.match(y, /Bash\(node:\*\),Bash\(mvn:\*\),Bash\(npm:\*\),Bash\(npx:\*\),/)
  assert.ok(!/@\w+@/.test(y), 'no pack placeholder left')
})
