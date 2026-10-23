// `agentic-sdlc doctor`: checks an installed repo. Each check is { level: 'ok' | 'warn' | 'fail', label, detail }.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { brokenRefs } from './refs.mjs'
import { hash, readManifest } from './install.mjs'

const has = (cmd, args = ['--version']) => {
  try { execFileSync(cmd, args, { stdio: 'ignore', shell: process.platform === 'win32' }); return true } catch { return false }
}

function* walk(root, rel = '') {
  for (const e of readdirSync(join(root, rel))) {
    if (['node_modules', '.git'].includes(e)) continue
    const r = rel ? `${rel}/${e}` : e
    if (statSync(join(root, r)).isDirectory()) yield* walk(root, r)
    else yield r
  }
}

export function doctor(root, payloadDir, { tools = has } = {}) {
  const out = []
  const add = (level, label, detail = '') => out.push({ level, label, detail })

  const major = Number(process.versions.node.split('.')[0])
  add(major >= 20 ? 'ok' : 'fail', 'Node >= 20', process.versions.node)
  add(existsSync(join(root, '.git')) ? 'ok' : 'warn', 'git repository', existsSync(join(root, '.git')) ? '' : 'not a git repo: autopilot and Evolve need one')

  const m = readManifest(root)
  if (!m) { add('fail', 'installed', 'no .agentic-sdlc/manifest.json: run `init`'); return out }
  add('ok', 'installed', `version ${m.version}`)
  const changed = Object.entries(m.files).filter(([p, h]) => existsSync(join(root, p)) && hash(readFileSync(join(root, p), 'utf8')) !== h).map(([p]) => p)
  const missing = Object.keys(m.files).filter((p) => !existsSync(join(root, p)))
  if (changed.length) add('ok', 'files you changed (kept by update)', changed.join(', '))
  if (missing.length) add('warn', 'installed files deleted', missing.join(', '))
  const pending = [...walk(root)].filter((p) => p.endsWith('.sdlc-new'))
  if (pending.length) add('warn', 'updates waiting to be merged', `${pending.join(', ')}: compare with your copy, then delete the .sdlc-new file`)

  let cfg = null
  try { cfg = JSON.parse(readFileSync(join(root, 'sdlc.config.json'), 'utf8')) } catch (e) {
    add('fail', 'sdlc.config.json', existsSync(join(root, 'sdlc.config.json')) ? `invalid JSON: ${e.message}` : 'missing')
  }
  if (cfg) {
    const comps = cfg.components ?? []
    if (!comps.length) add('warn', 'components', 'none: gates and QA have nothing to run; add one per app or package')
    for (const c of comps) {
      if (!c.gates?.length) add('warn', `component ${c.name}`, 'no gates: auto-merge will refuse changes here')
      if (!c.qa?.run || !c.qa?.junit) add('warn', `component ${c.name}`, 'no qa.run/qa.junit: qa-twice cannot run its tests')
    }
    if (comps.length && comps.every((c) => c.gates?.length)) add('ok', 'components', comps.map((c) => `${c.name} (${c.gates.length} gates)`).join(', '))
  }

  const settingsFile = join(root, '.claude/settings.json')
  const ours = JSON.parse(readFileSync(join(payloadDir, '.claude/settings.json'), 'utf8'))
  if (!existsSync(settingsFile)) add('fail', 'hooks wired', '.claude/settings.json missing')
  else {
    const s = JSON.parse(readFileSync(settingsFile, 'utf8'))
    const have = new Set(Object.values(s.hooks ?? {}).flat().flatMap((g) => (g.hooks ?? []).map((h) => h.command)))
    const want = Object.values(ours.hooks).flat().flatMap((g) => g.hooks.map((h) => h.command))
    const absent = [...new Set(want.filter((c) => !have.has(c)))]
    add(absent.length ? 'fail' : 'ok', 'hooks wired', absent.length ? `missing in settings.json: ${absent.join('; ')}` : `${new Set(want).size} hooks`)
  }

  const refs = brokenRefs(root)
  add(refs.length ? 'fail' : 'ok', 'references resolve', refs.map((r) => `${r.ref} (in ${r.file})`).join(', '))

  add(tools('gh') ? 'ok' : 'warn', 'gh CLI', tools('gh') ? '' : 'needed by autopilot headless, Evolve and agent-metrics')
  add(tools('claude') ? 'ok' : 'warn', 'claude CLI', tools('claude') ? '' : 'needed by the Evolve eval gate')
  if ((m.workflows ?? []).length) add('ok', 'workflows', `${m.workflows.join(', ')}: needs the CLAUDE_CODE_OAUTH_TOKEN secret (and AUTOPILOT_MERGE_TOKEN for auto-merge)`)
  return out
}
