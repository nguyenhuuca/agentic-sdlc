#!/usr/bin/env node
// agentic-sdlc: install the Claude Code SDLC setup into a repository, keep it updated, check it, or remove it.
//   npx github:nguyenhuuca/agentic-sdlc init [--dry-run] [--yes] [--packs a,b] [--with autopilot,evolve] [--target dir]
//   npx github:nguyenhuuca/agentic-sdlc update [--dry-run] [--yes] [--with ...]
//   npx github:nguyenhuuca/agentic-sdlc doctor
//   npx github:nguyenhuuca/agentic-sdlc uninstall [--dry-run] [--yes]
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { apply, buildConfig, detect, loadPacks, planInstall, planUninstall, readManifest, summarize, WORKFLOWS } from '../lib/install.mjs'
import { doctor } from '../lib/doctor.mjs'

const HOME = dirname(dirname(fileURLToPath(import.meta.url)))
const PAYLOAD = join(HOME, 'payload')
const VERSION = JSON.parse(readFileSync(join(HOME, 'package.json'), 'utf8')).version

export function parseArgs(argv) {
  const a = { cmd: argv[0], dryRun: false, yes: false, packs: null, with: null, target: process.cwd() }
  const list = (v, name) => {
    if (!v || v.startsWith('--')) throw new Error(`${name} needs a comma-separated value`)
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }
  for (let i = 1; i < argv.length; i++) {
    const f = argv[i]
    if (f === '--dry-run') a.dryRun = true
    else if (f === '--yes' || f === '-y') a.yes = true
    else if (f === '--packs') a.packs = list(argv[++i], f)
    else if (f === '--with') a.with = list(argv[++i], f)
    else if (f === '--target') a.target = resolve(argv[++i] ?? '.')
    else throw new Error(`unknown option ${f}`)
  }
  if (!['init', 'update', 'doctor', 'uninstall'].includes(a.cmd)) throw new Error('command: init | update | doctor | uninstall')
  const bad = (a.with ?? []).find((w) => !(w in WORKFLOWS))
  if (bad) throw new Error(`--with knows ${Object.keys(WORKFLOWS).join(', ')}, not ${bad}`)
  return a
}

async function confirm(question) {
  if (!process.stdin.isTTY) return false
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`${question} [y/N] `)
  rl.close()
  return /^y(es)?$/i.test(answer.trim())
}

async function run(plan, a, verb) {
  const lines = summarize(plan)
  console.log(lines.length ? lines.join('\n') : 'nothing to change')
  if (!lines.length || a.dryRun) return 0
  const writes = plan.actions.filter((x) => x.op !== 'keep').length
  if (!a.yes && !(await confirm(`${verb}: apply ${writes} change(s) to ${a.target}?`))) {
    console.log(process.stdin.isTTY ? 'nothing written' : 'nothing written: not a terminal, pass --yes to apply')
    return 1
  }
  apply(a.target, plan)
  console.log(`done. Next: review the diff, then commit.${plan.actions.some((x) => x.op === 'sdlc-new') ? ' Merge the .sdlc-new files by hand.' : ''}`)
  return 0
}

async function main(argv) {
  let a
  try { a = parseArgs(argv) } catch (e) { console.error(`agentic-sdlc ${VERSION}: ${e.message}`); return 2 }
  if (!existsSync(a.target)) { console.error(`no such directory: ${a.target}`); return 2 }

  if (a.cmd === 'doctor') {
    const checks = doctor(a.target, PAYLOAD)
    for (const c of checks) console.log(`${{ ok: '✔', warn: '!', fail: '✖' }[c.level]} ${c.label}${c.detail ? `: ${c.detail}` : ''}`)
    return checks.some((c) => c.level === 'fail') ? 1 : 0
  }
  if (a.cmd === 'uninstall') return run(planUninstall(a.target, PAYLOAD), a, 'uninstall')

  const manifest = readManifest(a.target)
  if (a.cmd === 'update' && !manifest) { console.error('not installed here: run init first'); return 2 }
  const hits = detect(a.target, loadPacks(join(HOME, 'packs')), a.packs)
  for (const h of hits) console.log(`detected ${h.pack.id} in ${h.dir || './'} (${h.evidence})`)
  if (!hits.length) console.log('no stack pack matched: sdlc.config.json gets no components; add them by hand')
  const detected = buildConfig(a.target, hits)
  // An existing sdlc.config.json is the repo's own: it is never rewritten, and its branch and tracking files win
  const ownFile = join(a.target, 'sdlc.config.json')
  const own = existsSync(ownFile) ? JSON.parse(readFileSync(ownFile, 'utf8')) : {}
  const cfg = { ...detected, ...own, tracking: { ...detected.tracking, ...own.tracking } }
  const workflows = a.with ?? manifest?.workflows ?? []
  const plan = planInstall(a.target, PAYLOAD, { mode: manifest ? 'update' : 'init', hits, cfg, version: VERSION, workflows })
  return run(plan, a, a.cmd)
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).then((code) => process.exit(code))
}
