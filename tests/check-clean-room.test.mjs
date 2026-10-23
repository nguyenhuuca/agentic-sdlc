import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findMatches, shingles, words } from '../scripts/check-clean-room.mjs'

test('words lowercases and drops punctuation', () => {
  assert.deepEqual(words('Read it, THEN write—don’t guess.'), ['read', 'it', 'then', 'write', 'don’t', 'guess'])
})

test('shingles are runs of n words', () => {
  assert.deepEqual([...shingles('a b c d', 3)], ['a b c', 'b c d'])
  assert.equal(shingles('a b', 3).size, 0)
})

test('findMatches reports a copied run once, ignores rewording and allowed phrases', () => {
  const up = [{ file: 'up.md', text: 'Never push to the main branch without asking the owner first, ever.' }]
  const own = [
    { file: 'copied.md', text: 'Rule: never push to the main branch without asking the owner first.' },
    { file: 'reworded.md', text: 'Ask the owner before every push to main.' },
    { file: 'allowed.md', text: 'never push to the main branch without asking' },
  ]
  const hits = findMatches(up, own, 6, ['never push to the main branch without asking'])
  assert.deepEqual(hits.map((h) => h.file), ['copied.md'])
})
