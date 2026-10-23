#!/usr/bin/env node
// SessionStart: shows the person a status report from session.txt (format: .claude/rules/session-file.md) and gives
// the model the same facts, plus a re-orientation note after a compaction. Prints nothing when session.txt is absent
// or empty.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readEvent, reply } from './lib.mjs'

const MAX_ITEMS = 8
const MAX_LEN = 70

export function parseSession(text) {
  const out = {}
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^([a-z]+):\s*(.*)$/.exec(line.trim())
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

const items = (v) => (v && v !== '-' ? v.split(';').map((s) => s.trim()).filter(Boolean) : [])
const clip = (s) => (s.length > MAX_LEN ? `${s.slice(0, MAX_LEN - 1)}…` : s)

export function report(s) {
  if (!s.task) return null
  const unfinished = s.status !== 'done'
  const lines = [`${unfinished ? 'Task in progress' : 'Last task'}: ${s.task}`]
  lines.push(`Status: ${s.status ?? '?'} · ${s.progress ?? '?'}% · updated ${s.updated ?? '?'}`)
  const done = items(s.done)
  for (const d of done.slice(-MAX_ITEMS)) lines.push(`✅ ${clip(d)}`)
  if (done.length > MAX_ITEMS) lines.push(`   (+${done.length - MAX_ITEMS} earlier)`)
  for (const d of items(s.doing)) lines.push(`🔄 ${clip(d)}`)
  if (s.status === 'blocked' && items(s.blocker)[0]) lines.push(`⛔ Blocked: ${clip(items(s.blocker)[0])}`)
  if (unfinished && items(s.next)[0]) lines.push(`Next: ${clip(items(s.next)[0])}`)
  if (s.plan && s.plan !== '-') lines.push(`Plan: ${s.plan}`)
  if (unfinished) lines.push('▶ /task-resume to continue')
  return lines.join('\n')
}

export function build(event, root) {
  const file = join(root, 'session.txt')
  const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const r = report(parseSession(text))
  const notes = []
  if (event?.source === 'compact') {
    notes.push('Context was just compacted: re-read session.txt, the active plan and any file before editing it (debugging-protocol.md, Stale Context Check).')
  }
  if (!r && !notes.length) return null
  const context = [r && `[session.txt]\n${r}`, ...notes].filter(Boolean).join('\n\n')
  const out = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } }
  if (r) {
    // after a compaction the person already saw the report at startup; only the model needs it again
    if (event?.source !== 'compact') out.systemMessage = r
    if (parseSession(text).status === 'done') out.hookSpecificOutput.additionalContext += '\nThe last task is done; the person has seen this report. Do not resume it.'
  }
  return out
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const event = readEvent()
  reply(build(event, process.env.CLAUDE_PROJECT_DIR || event?.cwd || process.cwd()))
}
