#!/usr/bin/env node
// Renders every payload workflow template with sample values, so CI can lint real YAML.
// Usage: node scripts/render-samples.mjs <out dir>
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from '../lib/render.mjs'

export const SAMPLE_VARS = {
  deployBranch: 'main',
  evolveCron: '0 2 * * 1',
  allowedBash: 'Bash(mvn:*),Bash(npm:*),Bash(npx:*),',
  setupSteps: [
    '- uses: actions/setup-java@v4',
    '  with:',
    "    distribution: 'temurin'",
    "    java-version: '21'",
    '- uses: actions/setup-node@v4',
    '  with:',
    "    node-version: '20'",
  ],
}

const DIR = 'payload/.github/workflows'

export function renderSamples(out, vars = SAMPLE_VARS) {
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
