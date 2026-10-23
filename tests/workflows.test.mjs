import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderSamples } from '../scripts/render-samples.mjs'

test('workflow templates render with no placeholder left and no project-specific text', () => {
  const files = renderSamples(mkdtempSync(join(tmpdir(), 'wf-')))
  assert.deepEqual(files.map((f) => f.split(/[\\/]/).pop()).sort(), ['agent-evolve.yml', 'autopilot.yml'])
  for (const f of files) {
    const y = readFileSync(f, 'utf8')
    assert.ok(!/\{\{\w+\}\}/.test(y), `${f} has a placeholder left`)
    assert.ok(!/webapp|api\/pom|qa-twice\.sh|claude-autopilot/.test(y), `${f} has project-specific text`)
  }
})

test('unattended steps read the trusted config copy, never the PR checkout', () => {
  const [ap] = renderSamples(mkdtempSync(join(tmpdir(), 'wf-'))).filter((f) => f.endsWith('autopilot.yml'))
  const y = readFileSync(ap, 'utf8')
  for (const script of ['autopilot-merge.sh', 'autopilot-cost.sh']) {
    const i = y.indexOf(`git show "origin/$BASE:scripts/sdlc/${script}"`)
    assert.ok(i > 0, script)
    const step = y.slice(y.lastIndexOf('- name:', i), y.indexOf('- name:', i))
    assert.match(step, /SDLC_HELPER: \$\{\{ runner\.temp \}\}\/sdlc-config\.mjs/, script)
    assert.match(step, /SDLC_CONFIG_FILE: \$\{\{ runner\.temp \}\}\/sdlc\.config\.json/, script)
    assert.match(step, /git show "origin\/\$BASE:sdlc\.config\.json"/, script)
  }
})
