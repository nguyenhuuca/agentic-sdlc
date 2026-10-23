import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addRow, missingStages, newLedger, readTable, run, totals } from '../autopilot-ledger.mjs'

const RES = join(dirname(fileURLToPath(import.meta.url)), '../../../.claude/skills/autopilot/resources')
const quiet = () => {}

test('start writes a ledger and remembers it; add numbers rows and rounds by itself', () => {
  const root = mkdtempSync(join(tmpdir(), 'led-'))
  const out = []
  const now = new Date(2026, 9, 23, 11, 5)
  assert.equal(run(['start', '--slug', 'item-count', '--request', 'Add\n itemCount'], { root, now, log: (l) => out.push(l) }), 0)
  assert.equal(out[0], 'scratchpad/autopilot/20261023-1105-item-count.md')
  for (const args of [
    ['--stage', 'plan', '--result', 'plan written', '--path', 'inline'],
    ['--stage', 'plan-review', '--result', 'revise', '--blocking', '1', '--advisory', '2', '--turns', '9', '--min', '1.5', '--tokens', '20000'],
    ['--stage', 'plan', '--result', 'plan revised'],
    ['--stage', 'plan-review', '--result', 'approve', '--blocking', '0', '--advisory', '1', '--min', '1', '--tokens', '15000'],
  ]) assert.equal(run(['add', ...args], { root, log: quiet }), 0)
  const text = readFileSync(join(root, out[0]), 'utf8')
  assert.match(text, /- \*\*Request:\*\* Add itemCount/)
  const rows = readTable(text).rows
  assert.deepEqual(rows.map((r) => [r['#'], r.stage, r.round, r.result]), [
    ['1', 'plan', '1', 'plan written'], ['2', 'plan-review', '1', 'revise'], ['3', 'plan', '2', 'plan revised'], ['4', 'plan-review', '2', 'approve'],
  ])
  assert.equal(rows[1].tokens, '20000')
  assert.deepEqual(totals(text), { runs: 4, min: 2.5, tokens: 35000 })
})

test('add rejects unknown stages, malformed results and non-numbers', () => {
  const text = newLedger({ slug: 's', request: 'r' })
  assert.throws(() => addRow(text, { stage: 'review', result: 'approve' }), /stage must be one of/)
  assert.throws(() => addRow(text, { stage: 'code-review', result: 'ok' }), /code-review result must match/)
  assert.throws(() => addRow(text, { stage: 'qa', result: 'flaky' }), /qa result must match/)
  assert.throws(() => addRow(text, { stage: 'implement', result: '' }), /--result is required/)
  assert.throws(() => addRow(text, { stage: 'implement', result: 'done', tokens: 'lots' }), /--tokens must be a number/)
  assert.equal(addRow(text, { stage: 'qa', result: 'flaky 2' }).row.result, 'flaky 2')
  assert.equal(addRow(text, { stage: 'gate2', result: 'no push' }).row.result, 'no push')
})

test('check names the stages a landed run is missing; note and total fill their sections', () => {
  const root = mkdtempSync(join(tmpdir(), 'led-'))
  run(['start', '--slug', 's', '--request', 'r'], { root, log: quiet })
  for (const s of ['plan', 'implement']) run(['add', '--stage', s, '--result', 'done'], { root, log: quiet })
  const out = []
  assert.equal(run(['check'], { root, log: (l) => out.push(l) }), 1)
  assert.match(out[0], /missing: plan-review, gate1, code-review, qa\. /)
  for (const [s, r] of [['plan-review', 'approve'], ['gate1', 'auto'], ['code-review', 'approve'], ['qa', 'pass']]) {
    run(['add', '--stage', s, '--result', r], { root, log: quiet })
  }
  assert.equal(run(['check'], { root, log: quiet }), 0, 'complete before Gate 2, which follows the commit')
  run(['add', '--stage', 'gate2', '--result', 'auto'], { root, log: quiet })
  run(['note', 'Open advisories: 2'], { root, log: quiet })
  run(['total'], { root, log: quiet })
  const file = readFileSync(join(root, 'scratchpad/autopilot/CURRENT'), 'utf8').trim()
  const text = readFileSync(join(root, file), 'utf8')
  assert.match(text, /## Notes\n\n- Open advisories: 2\n/)
  assert.match(text, /## Total\n\n7 runs · 0 min · 0 tokens\n/)
})

test('the template ledger and the headless report: placeholder rows go, columns follow the header', () => {
  const tpl = readFileSync(join(RES, 'ledger.template.md'), 'utf8')
  const fromTpl = addRow(tpl, { stage: 'plan', result: 'plan written' }).text
  assert.deepEqual(readTable(fromTpl).rows.map((r) => [r['#'], r.stage]), [['1', 'plan']], 'the placeholder row is gone')
  const root = mkdtempSync(join(tmpdir(), 'led-'))
  mkdirSync(join(root, 'docs/reports'), { recursive: true })
  writeFileSync(join(root, 'docs/reports/autopilot-x.md'), readFileSync(join(RES, 'report.template.md'), 'utf8'))
  assert.equal(run(['add', '--file', 'docs/reports/autopilot-x.md', '--stage', 'code-review', '--result', 'approve', '--model', 'sonnet'], { root, log: quiet }), 0)
  const t = readTable(readFileSync(join(root, 'docs/reports/autopilot-x.md'), 'utf8'))
  assert.equal(t.columns.at(-1), 'model')
  assert.deepEqual(t.rows.map((r) => [r.stage, r.model]), [['code-review', 'sonnet']])
  assert.deepEqual(missingStages(readFileSync(join(root, 'docs/reports/autopilot-x.md'), 'utf8')), ['plan', 'plan-review', 'gate1', 'implement', 'qa'])
})

test('usage errors exit 2', () => {
  const root = mkdtempSync(join(tmpdir(), 'led-'))
  assert.equal(run(['add', '--stage', 'plan', '--result', 'x'], { root, log: quiet }), 2)
  assert.equal(run(['start', '--slug', 'bad slug', '--request', 'r'], { root, log: quiet }), 2)
  assert.equal(run(['start', '--slug'], { root, log: quiet }), 2)
  assert.equal(run(['nope'], { root, log: quiet }), 2)
})
