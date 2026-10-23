import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { classify, junitResults, parseArgs, run, safeReportPath } from '../qa-twice.mjs'

test('parseArgs splits component=tests and rejects shell characters', () => {
  assert.deepEqual(parseArgs(['api=FooTest,BarTest#x', 'web=src/a.test.jsx']), [
    { component: 'api', tests: ['FooTest', 'BarTest#x'] },
    { component: 'web', tests: ['src/a.test.jsx'] },
  ])
  assert.throws(() => parseArgs(['api=Foo;rm -rf /']), /characters outside/)
  assert.throws(() => parseArgs(['FooTest']), /expected <component>=<tests>/)
})

test('safeReportPath keeps the deleted report inside the repo', () => {
  assert.equal(safeReportPath('api/target/surefire-reports').replaceAll('\\', '/'), 'api/target/surefire-reports')
  for (const p of ['', '.', '../x', 'a/../../x', '/tmp/x']) assert.throws(() => safeReportPath(p), /relative path/, p)
})

test('junitResults reads pass, failure, error and skips skipped', () => {
  const xml = `<testsuite><testcase classname="A" name="ok"/>
    <testcase classname="A" name="bad"><failure message="x"/></testcase>
    <testcase classname="A" name="boom"><error/></testcase>
    <testcase classname="A" name="later"><skipped/></testcase></testsuite>`
  assert.deepEqual([...junitResults(xml, 'api')], [['api A#ok', true], ['api A#bad', false], ['api A#boom', false]])
})

test('classify: both pass, one pass, none; a test missing from one run counts as failed there', () => {
  const r1 = new Map([['a', true], ['b', true], ['c', false], ['d', true]])
  const r2 = new Map([['a', true], ['b', false], ['c', false]])
  assert.deepEqual(classify(r1, r2).map((r) => [r.key, r.status]), [['a', 'pass'], ['b', 'flaky'], ['c', 'fail'], ['d', 'flaky']])
})

test('run executes the configured command twice and finds a flaky test', () => {
  const root = mkdtempSync(join(tmpdir(), 'qa2-'))
  // Fake runner: test "t2" passes on the first run only (a counter file keeps state between runs)
  writeFileSync(join(root, 'fake.mjs'), `import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const n = existsSync('count') ? Number(readFileSync('count', 'utf8')) + 1 : 1
writeFileSync('count', String(n))
mkdirSync('out', { recursive: true })
const t2 = n === 1 ? '<testcase classname="S" name="t2"/>' : '<testcase classname="S" name="t2"><failure/></testcase>'
writeFileSync('out/TEST-S.xml', '<testsuite><testcase classname="S" name="' + process.argv[2] + '"/>' + t2 + '</testsuite>')`)
  writeFileSync(join(root, 'sdlc.config.json'), JSON.stringify({
    components: [{ name: 'app', path: '', qa: { run: 'node fake.mjs {tests}', junit: 'out' } }],
  }))
  const lines = []
  assert.equal(run(['app=t1'], { root, log: (l) => lines.push(l) }), 0)
  assert.ok(lines.includes('FLAKY  app S#t2'), lines.join('\n'))
  assert.ok(lines.at(-1).startsWith('QA-TWICE: 2 tests | pass 1 | flaky 1 | fail 0'))
  assert.equal(run(['nope=t1'], { root, log: () => {} }), 2)
})
