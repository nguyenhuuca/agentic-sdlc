import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, demote, frontmatter } from '../scripts/build-docs-reference.mjs'

test('frontmatter and heading demotion leave code fences alone', () => {
  assert.deepEqual(frontmatter('---\nname: x\ndescription: "a: b"\n---\n# T\n').meta, { name: 'x', description: 'a: b' })
  assert.equal(demote('# A\n## B\n```\n# comment\n```\n'), '## A\n### B\n```\n# comment\n```\n')
})

test('reference pages cover every rule, agent, skill and pack, with one heading per item', () => {
  const out = mkdtempSync(join(tmpdir(), 'ref-'))
  assert.deepEqual(build(out).sort(), ['agents.md', 'hooks.md', 'packs.md', 'rules.md', 'skills.md', 'templates.md'])
  const page = (f) => readFileSync(join(out, f), 'utf8')
  const h2 = (f) => page(f).match(/^## .+$/gm) ?? []
  assert.equal(h2('agents.md').length, 5)
  assert.equal(h2('rules.md').length, 7)
  const skills = h2('skills.md')
  assert.equal(skills.length, 15)
  assert.equal(new Set(skills.map((s) => s.toLowerCase())).size, 15, 'no skill title repeated under its own heading')
  assert.match(page('skills.md'), /<code>\[--auto &#124; --auto-push\] &lt;feature or fix request&gt;/)
  assert.match(page('hooks.md'), /`Bash\(git push -f:\*\)`/)
  assert.equal((page('packs.md').match(/^\| \[`/gm) ?? []).length, 4)
})
