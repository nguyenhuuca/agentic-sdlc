#!/usr/bin/env node
// Fails when any text in this repo repeats a run of N words from the upstream framework, which has no license
// (ADR-0001). Ideas and names may match; sentences may not. Usage:
//   node scripts/check-clean-room.mjs --upstream <checkout> [--words 10] [paths...]
import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const TEXT = new Set(['.md', '.sh', '.json', '.mjs', '.js', '.yml', '.yaml', '.txt', '.tmpl', ''])
const SKIP_DIRS = new Set(['.git', 'node_modules'])

export function words(text) {
  return text.toLowerCase().match(/[a-z0-9]+(?:['’][a-z]+)?/g) ?? []
}

export function shingles(text, n) {
  const w = words(text)
  const out = new Set()
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '))
  return out
}

export function* textFiles(root) {
  const st = lstatSync(root)
  if (st.isFile()) { if (TEXT.has(extname(root))) yield root; return }
  if (!st.isDirectory()) return
  for (const e of readdirSync(root)) {
    if (SKIP_DIRS.has(e)) continue
    yield* textFiles(join(root, e))
  }
}

// allow: phrases (any length >= n words) that may repeat, e.g. a license line or a CLI flag list
export function findMatches(upstreamTexts, ownTexts, n, allow = []) {
  const up = new Set()
  for (const t of upstreamTexts) for (const s of shingles(t.text, n)) up.add(s)
  const allowed = new Set(allow.flatMap((a) => [...shingles(a, n)]))
  const hits = []
  for (const t of ownTexts) {
    const w = words(t.text)
    for (let i = 0; i + n <= w.length; i++) {
      const s = w.slice(i, i + n).join(' ')
      if (up.has(s) && !allowed.has(s)) {
        hits.push({ file: t.file, shingle: s })
        i += n - 1  // report each run once
      }
    }
  }
  return hits
}

function readAll(root) {
  return [...textFiles(root)].map((file) => ({ file, text: readFileSync(file, 'utf8') }))
}

function main(argv) {
  const args = { words: 10, paths: [] }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--upstream') args.upstream = argv[++i]
    else if (argv[i] === '--words') args.words = Number(argv[++i])
    else args.paths.push(argv[i])
  }
  if (!args.upstream || !existsSync(args.upstream)) {
    console.error('usage: check-clean-room.mjs --upstream <checkout> [--words N] [paths...]')
    return 2
  }
  const paths = args.paths.length ? args.paths : ['payload', 'packs', 'docs', 'README.md', 'bin', 'scripts']
  const allowFile = '.clean-room-allow'
  const allow = existsSync(allowFile)
    ? readFileSync(allowFile, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'))
    : []
  const own = paths.filter(existsSync).flatMap(readAll)
  const hits = findMatches(readAll(args.upstream), own, args.words, allow)
  for (const h of hits) console.log(`${relative('.', h.file)}: "${h.shingle}"`)
  console.log(hits.length ? `${hits.length} run(s) of ${args.words} words match upstream` : `clean: ${own.length} files`)
  return hits.length ? 1 : 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)))
