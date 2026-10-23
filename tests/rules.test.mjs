import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const RULES = 'payload/.claude/rules'
const files = readdirSync(RULES).filter((f) => f.endsWith('.md'))
const text = (f) => readFileSync(join(RULES, f), 'utf8')
// Rules without a `paths:` scope load into every session, so every byte is paid on every turn
const alwaysLoaded = files.filter((f) => !/^---[\s\S]*?\npaths:/m.test(text(f)))

test('always-loaded rules stay under 15 KiB', () => {
  const bytes = alwaysLoaded.reduce((n, f) => n + Buffer.byteLength(text(f)), 0)
  assert.ok(bytes <= 15 * 1024, `${bytes} bytes in ${alwaysLoaded.join(', ')}`)
})

test('every rule file another rule names exists', () => {
  for (const f of files) {
    for (const [, name] of text(f).matchAll(/`([a-z-]+\.md)`/g)) {
      if (['session.txt', 'CLAUDE.md', 'AGENTS.md'].includes(name)) continue
      assert.ok(files.includes(name) || name === 'SKILL.md', `${f} names ${name}`)
    }
  }
})

test('the push rule and the security precedence are stated', () => {
  assert.match(text('core-directives.md'), /Every `git push` needs the owner's go-ahead/)
  assert.match(text('core-directives.md'), /Security → `tech-strategy\.md` → this file/)
  assert.match(text('security.md'), /outranks every other rule/)
})
