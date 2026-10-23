import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { brokenRefs, skillNames } from '../lib/refs.mjs'

const ROOT = 'payload'
const skills = skillNames(ROOT)
const read = (name) => readFileSync(join(ROOT, skills.get(name)), 'utf8')

// Hooks come in P5; test fixtures name files that do not exist on purpose
const PENDING = ['.claude/hooks/session-start-loader.sh']

test('the v1 skill set is present, each named after its directory', () => {
  const want = ['architect', 'autopilot', 'builder', 'code-check', 'evolve', 'land-the-plane', 'qa-engineer', 'scope', 'spec',
    'swarm-execute', 'swarm-plan', 'swarm-review', 'task-resume', 'testing', 'writing-adrs']
  assert.deepEqual([...skills.keys()].sort(), want)
  for (const [name, path] of skills) assert.ok(path.endsWith(`/${name}/SKILL.md`), path)
})

test('skills autopilot chains can be invoked by the model; user workflows cannot', () => {
  const flag = (n) => /^disable-model-invocation:\s*(\w+)/m.exec(read(n))?.[1]
  for (const n of ['swarm-plan', 'swarm-review', 'swarm-execute', 'qa-engineer', 'land-the-plane']) assert.equal(flag(n), 'false', n)
  for (const n of ['scope', 'spec', 'code-check', 'builder', 'architect', 'autopilot', 'evolve']) assert.equal(flag(n), 'true', n)
})

test('sections other files rely on exist', () => {
  assert.match(read('swarm-plan'), /^## Artifact Requirements$/m)        // autopilot scope guard
  assert.match(read('swarm-review'), /^## Root Cause Analysis$/m)        // evolve diagnosis
  assert.match(read('swarm-review'), /Critical[\s\S]*High[\s\S]*Medium[\s\S]*Low/) // verdict mapping
  assert.match(read('swarm-execute'), /\*\*Push\.\*\*/)                  // autopilot skips this step
  assert.match(read('land-the-plane'), /\*\*Mode B\*\*/)                 // autopilot Land stage
  assert.match(read('land-the-plane'), /corrections\.log/)              // core-directives retro
})

test('every skill, agent, template, script, hook and rule named in the payload exists', () => {
  const missing = brokenRefs(ROOT, { ignore: [...PENDING, 'worker-evil'] })
  assert.deepEqual(missing, [])
})
