#!/usr/bin/env node
// Runs every *.test.mjs under tests/ and payload/scripts/sdlc/__tests__/ with node:test. A runner instead of a shell
// glob, because npm runs scripts with cmd.exe on Windows, which does not expand globs.
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const dirs = ['tests', 'payload/scripts/sdlc/__tests__']
const files = dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.test.mjs')).map((f) => join(d, f)))
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' })
process.exit(r.status ?? 1)
