#!/usr/bin/env node
// Renders every payload workflow template with sample values, so CI can lint real YAML.
// Usage: node scripts/render-samples.mjs <out dir>
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from '../lib/render.mjs'
import { loadPacks, workflowVars } from '../lib/install.mjs'

// Every pack at once, in a sub-directory, with its default versions: the widest workflow a repo can get
export function sampleVars() {
  const hits = loadPacks('packs').map((pack) => ({
    pack, dir: 'app/', vars: Object.fromEntries(Object.entries(pack.vars ?? {}).map(([k, v]) => [k, v.default ?? ''])),
  }))
  return workflowVars(hits, { deployBranch: 'main' }, '0.0.0')
}

const DIR = 'payload/.github/workflows'

export function renderSamples(out, vars = sampleVars()) {
  mkdirSync(out, { recursive: true })
  const written = []
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.yml.tmpl'))) {
    const target = join(out, f.replace(/\.tmpl$/, ''))
    writeFileSync(target, render(readFileSync(join(DIR, f), 'utf8'), vars))
    written.push(target)
  }
  return written
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const f of renderSamples(process.argv[2] ?? 'scratchpad/rendered-workflows')) console.log(f)
}
