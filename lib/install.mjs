// Installer core: works out what `init`, `update` and `uninstall` would change in a target repo (a plan of actions),
// then applies it. Nothing is written outside `apply`, so --dry-run and the confirmation prompt show exactly what
// will happen.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { render } from './render.mjs'
import { DEFAULTS } from '../payload/scripts/sdlc/sdlc-config.mjs'

export const MANIFEST = '.agentic-sdlc/manifest.json'
const SKIP_DIRS = new Set(['__tests__', 'node_modules', '.git'])
const SEARCH_SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'target', 'vendor', '.venv', 'venv', '.claude', 'scratchpad'])
const GITIGNORE_LINES = ['scratchpad/', '.claude/settings.local.json', 'evolve-out/', '*.sdlc-new']
export const WORKFLOWS = { autopilot: 'autopilot.yml.tmpl', evolve: 'agent-evolve.yml.tmpl' }
const BLOCK = /<!-- agentic-sdlc:begin[\s\S]*?<!-- agentic-sdlc:end -->\n?/

// Line endings differ by platform (core.autocrlf); a file is "unchanged" when only those differ
export const hash = (text) => createHash('sha256').update(String(text).replace(/\r\n/g, '\n')).digest('hex')
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null)

function* walk(root, rel = '') {
  for (const e of readdirSync(join(root, rel))) {
    if (SKIP_DIRS.has(e)) continue
    const r = rel ? `${rel}/${e}` : e
    if (statSync(join(root, r)).isDirectory()) yield* walk(root, r)
    else yield r
  }
}

// ---- packs ----

export function loadPacks(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((d) => existsSync(join(dir, d, 'pack.json')))
    .map((d) => ({ id: d, ...JSON.parse(readFileSync(join(dir, d, 'pack.json'), 'utf8')) }))
}

// A pack matches a directory (the root or one level down) holding one of its detect files
export function detect(root, packs, only = null) {
  const dirs = ['', ...readdirSync(root).filter((d) => !SEARCH_SKIP.has(d) && !d.startsWith('.') && statSync(join(root, d)).isDirectory())]
  const hits = []
  for (const pack of packs) {
    if (only && !only.includes(pack.id)) continue
    for (const d of dirs) {
      const found = (pack.detect ?? []).find((f) => existsSync(join(root, d, f)))
      if (found) hits.push({ pack, dir: d ? `${d}/` : '', evidence: `${d ? `${d}/` : ''}${found}` })
    }
  }
  return hits
}

const subst = (s, h) => String(s).replaceAll('@dir@', h.dir).replaceAll('@name@', componentName(h))
const componentName = (h) => h.pack.component?.name ?? (h.dir ? basename(h.dir) : h.pack.id)

export function componentFor(root, h) {
  const c = h.pack.component ?? {}
  const gates = (c.gates ?? []).map((g) => subst(g, h))
  // scriptGates: { script: command } kept only when that script exists in the component's package.json
  if (c.scriptGates) {
    const pkg = JSON.parse(read(join(root, h.dir, 'package.json')) ?? '{}')
    for (const [script, cmd] of Object.entries(c.scriptGates)) if (pkg.scripts?.[script]) gates.push(subst(cmd, h))
  }
  const out = { name: componentName(h), path: h.dir, gates }
  if (c.qa) out.qa = Object.fromEntries(Object.entries(c.qa).map(([k, v]) => [k, subst(v, h)]))
  return out
}

function defaultBranch(root) {
  try {
    return execFileSync('git', ['-C', root, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .trim().replace(/^origin\//, '')
  } catch {
    try { return execFileSync('git', ['-C', root, 'branch', '--show-current'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'main' } catch { return 'main' }
  }
}

export function buildConfig(root, hits) {
  const uniq = (xs) => [...new Set(xs)]
  const cfg = {
    deployBranch: defaultBranch(root),
    maxLoc: DEFAULTS.maxLoc,
    components: hits.map((h) => componentFor(root, h)),
    smoke: null,
    buildWorkflow: null,
    tracking: { ...DEFAULTS.tracking },
  }
  const extraProtected = uniq(hits.flatMap((h) => (h.pack.extraProtectedPaths ?? []).map((p) => subst(p, h))))
  if (extraProtected.length) cfg.extraProtectedPaths = extraProtected
  const extraUncounted = hits.flatMap((h) => h.pack.uncountedPaths ?? [])
  if (extraUncounted.length) cfg.uncountedPaths = uniq([...DEFAULTS.uncountedPaths, ...extraUncounted])
  return cfg
}

export function workflowVars(hits, cfg, version) {
  const steps = []
  const seen = new Set()
  for (const h of hits) {
    for (const s of h.pack.setupSteps ?? []) {
      const block = JSON.stringify(s)
      if (seen.has(block)) continue
      seen.add(block)
      steps.push(...(Array.isArray(s) ? s : [s]).map((l) => subst(l, h)))
    }
  }
  const bash = [...new Set(hits.flatMap((h) => h.pack.allowedBash ?? []))]
  return {
    deployBranch: cfg.deployBranch,
    evolveCron: '0 2 * * 1',
    setupSteps: steps,
    allowedBash: bash.map((b) => `Bash(${b}:*),`).join(''),
    version,
  }
}

// ---- merged files ----

export function fillTechStrategy(text, hits) {
  const rows = hits.flatMap((h) => (h.pack.stack ?? []).map(([k, v]) => [k, `${v}${h.dir ? ` (\`${h.dir}\`)` : ''}`]))
  const prohibited = [...new Set(hits.flatMap((h) => h.pack.prohibited ?? []))]
  let out = text
  if (rows.length) {
    const table = ['| Area | Choice |', '|------|--------|', ...rows.map(([k, v]) => `| ${k} | ${v} |`)].join('\n')
    out = out.replace(/(<!-- sdlc:stack -->\n)[\s\S]*?(\n<!-- \/sdlc:stack -->)/, `$1${table}$2`)
  }
  if (prohibited.length) {
    out = out.replace(/(<!-- sdlc:prohibited -->\n)[\s\S]*?(\n<!-- \/sdlc:prohibited -->)/, `$1${prohibited.map((p) => `- ${p}`).join('\n')}$2`)
  }
  return out
}

// Adds our deny rules and hooks; never removes or reorders what the repo already has
export function mergeSettings(existing, ours) {
  const out = structuredClone(existing ?? {})
  out.permissions ??= {}
  out.permissions.deny = [...new Set([...(out.permissions.deny ?? []), ...(ours.permissions?.deny ?? [])])]
  out.hooks ??= {}
  for (const [event, groups] of Object.entries(ours.hooks ?? {})) {
    out.hooks[event] ??= []
    const have = new Set(out.hooks[event].flatMap((g) => (g.hooks ?? []).map((x) => x.command)))
    for (const g of groups) {
      const missing = g.hooks.filter((x) => !have.has(x.command))
      if (missing.length) out.hooks[event].push({ ...g, hooks: missing })
    }
  }
  if (!out.statusLine && ours.statusLine) out.statusLine = ours.statusLine
  return out
}

// Removes our hooks (matched by command) and statusline; deny rules stay, since removing protection is the riskier error
export function unmergeSettings(existing, ours) {
  const out = structuredClone(existing ?? {})
  const commands = new Set(Object.values(ours.hooks ?? {}).flat().flatMap((g) => g.hooks.map((x) => x.command)))
  for (const [event, groups] of Object.entries(out.hooks ?? {})) {
    out.hooks[event] = groups.map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((x) => !commands.has(x.command)) })).filter((g) => g.hooks.length)
    if (!out.hooks[event].length) delete out.hooks[event]
  }
  if (out.hooks && !Object.keys(out.hooks).length) delete out.hooks
  if (JSON.stringify(out.statusLine) === JSON.stringify(ours.statusLine)) delete out.statusLine
  return out
}

export function mergeClaudeMd(existing, block) {
  if (!existing) return `# CLAUDE.md\n\nProject context for Claude Code: what this repository is, how to run it, conventions that are not obvious from the code.\n\n${block}`
  if (BLOCK.test(existing)) return existing.replace(BLOCK, block)
  return `${existing.replace(/\n*$/, '\n\n')}${block}`
}

export const removeClaudeMdBlock = (existing) => existing.replace(BLOCK, '').replace(/\n+$/, '\n')

export function mergeGitignore(existing) {
  const lines = (existing ?? '').split(/\r?\n/)
  const missing = GITIGNORE_LINES.filter((l) => !lines.includes(l))
  if (!missing.length) return existing
  return `${(existing ?? '').replace(/\n*$/, existing ? '\n' : '')}${existing ? '\n' : ''}# agentic-sdlc\n${missing.join('\n')}\n`
}

// ---- plans ----

// The payload as { dest: content } for this repo: rendered templates, filled tech strategy, chosen workflows
export function payloadFor(payloadDir, { hits, cfg, version, workflows = [] }) {
  const vars = workflowVars(hits, cfg, version)
  const files = {}
  for (const rel of walk(payloadDir)) {
    if (rel === 'CLAUDE.md.tmpl' || rel === '.claude/settings.json') continue
    const text = readFileSync(join(payloadDir, rel), 'utf8')
    if (rel.startsWith('.github/workflows/')) {
      const which = Object.entries(WORKFLOWS).find(([, f]) => rel.endsWith(f))?.[0]
      if (which && workflows.includes(which)) files[rel.replace(/\.tmpl$/, '')] = render(text, vars)
      continue
    }
    files[rel] = rel === '.claude/rules/tech-strategy.md' ? fillTechStrategy(text, hits) : text
  }
  return files
}

export function readManifest(root) {
  const m = read(join(root, MANIFEST))
  return m ? JSON.parse(m) : null
}

// mode 'init' | 'update'. Actions: { op, path, content?, note? }
//   create   new file                         update  ours, unchanged by the user, new content
//   sdlc-new the user changed it: <path>.sdlc-new gets ours    keep    user-deleted or user-changed file left alone
//   delete   ours, unchanged, no longer shipped                merge   settings.json, CLAUDE.md, .gitignore, config
export function planInstall(root, payloadDir, { mode, hits, cfg, version, workflows }) {
  const manifest = readManifest(root)
  const known = manifest?.files ?? {}
  const files = payloadFor(payloadDir, { hits, cfg, version, workflows })
  const actions = []
  const nextManifest = { version, workflows, files: {} }
  for (const [path, content] of Object.entries(files)) {
    const cur = read(join(root, path))
    const ours = hash(content)
    if (cur === null) {
      if (mode === 'update' && known[path]) { actions.push({ op: 'keep', path, note: 'deleted in this repo; not restored' }); continue }
      actions.push({ op: 'create', path, content }); nextManifest.files[path] = ours; continue
    }
    const h = hash(cur)
    if (h === ours) { nextManifest.files[path] = ours; continue }  // already identical
    if (known[path] === h) { actions.push({ op: 'update', path, content }); nextManifest.files[path] = ours; continue }
    actions.push({ op: 'sdlc-new', path, content, note: known[path] ? 'changed in this repo' : 'existed before install' })
    if (known[path]) nextManifest.files[path] = known[path]
  }
  for (const [path, h] of Object.entries(known)) {
    if (path in files) continue
    const cur = read(join(root, path))
    if (cur !== null && hash(cur) === h) actions.push({ op: 'delete', path, note: 'no longer shipped' })
    else if (cur !== null) actions.push({ op: 'keep', path, note: 'no longer shipped, but changed in this repo' })
  }
  const settingsPath = '.claude/settings.json'
  const ourSettings = JSON.parse(readFileSync(join(payloadDir, settingsPath), 'utf8'))
  const curSettings = read(join(root, settingsPath))
  const merged = `${JSON.stringify(mergeSettings(curSettings ? JSON.parse(curSettings) : {}, ourSettings), null, 2)}\n`
  if (merged !== curSettings) actions.push({ op: 'merge', path: settingsPath, content: merged })
  const block = render(readFileSync(join(payloadDir, 'CLAUDE.md.tmpl'), 'utf8'), {
    version, tasksFile: cfg.tracking.tasks, statusFile: cfg.tracking.status,
  })
  const curClaude = read(join(root, 'CLAUDE.md'))
  const claude = mergeClaudeMd(curClaude, block)
  if (claude !== curClaude) actions.push({ op: 'merge', path: 'CLAUDE.md', content: claude })
  const curIgnore = read(join(root, '.gitignore'))
  const ignore = mergeGitignore(curIgnore)
  if (ignore !== curIgnore) actions.push({ op: 'merge', path: '.gitignore', content: ignore })
  if (!existsSync(join(root, 'sdlc.config.json'))) {
    actions.push({ op: 'create', path: 'sdlc.config.json', content: `${JSON.stringify(cfg, null, 2)}\n`, note: 'yours to edit; never updated' })
  }
  return { actions, manifest: nextManifest }
}

export function planUninstall(root, payloadDir) {
  const manifest = readManifest(root)
  if (!manifest) return { actions: [], manifest: null }
  const actions = []
  for (const [path, h] of Object.entries(manifest.files)) {
    const cur = read(join(root, path))
    if (cur === null) continue
    actions.push(hash(cur) === h ? { op: 'delete', path } : { op: 'keep', path, note: 'changed in this repo' })
  }
  const settingsPath = '.claude/settings.json'
  const cur = read(join(root, settingsPath))
  if (cur) {
    const ours = JSON.parse(readFileSync(join(payloadDir, settingsPath), 'utf8'))
    actions.push({ op: 'merge', path: settingsPath, content: `${JSON.stringify(unmergeSettings(JSON.parse(cur), ours), null, 2)}\n` })
  }
  const claude = read(join(root, 'CLAUDE.md'))
  if (claude && BLOCK.test(claude)) actions.push({ op: 'merge', path: 'CLAUDE.md', content: removeClaudeMdBlock(claude) })
  actions.push({ op: 'delete', path: MANIFEST })
  return { actions, manifest: null }
}

export function apply(root, { actions, manifest }) {
  for (const a of actions) {
    const target = join(root, a.op === 'sdlc-new' ? `${a.path}.sdlc-new` : a.path)
    if (a.op === 'delete') { rmSync(target, { force: true }); continue }
    if (a.op === 'keep') continue
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, a.content)
  }
  if (manifest) {
    mkdirSync(join(root, dirname(MANIFEST)), { recursive: true })
    writeFileSync(join(root, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`)
  }
}

export function summarize({ actions }) {
  const order = ['create', 'update', 'merge', 'sdlc-new', 'delete', 'keep']
  return order.flatMap((op) => actions.filter((a) => a.op === op).map((a) => `${op.padEnd(8)} ${a.path}${a.note ? `  (${a.note})` : ''}`))
}
