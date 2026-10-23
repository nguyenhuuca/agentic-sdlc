import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../lib/render.mjs'

test('inline values and indented blocks', () => {
  const t = 'on: {{branch}}\nsteps:\n    # {{setup}}\n    - run: x\n'
  assert.equal(render(t, { branch: 'main', setup: ['- uses: a@v1', '  with: { b: 1 }'] }),
    'on: main\nsteps:\n    - uses: a@v1\n      with: { b: 1 }\n    - run: x\n')
})

test('an empty block leaves no stray lines; a missing name fails', () => {
  assert.equal(render('a\n  # {{none}}\nb\n', { none: [] }), 'a\n\nb\n')
  assert.throws(() => render('x {{nope}} # {{also}}', {}), /template needs nope/)
})
