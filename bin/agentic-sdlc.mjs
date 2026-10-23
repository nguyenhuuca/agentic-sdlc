#!/usr/bin/env node
// agentic-sdlc: install the Claude Code SDLC setup into a repository, keep it updated, check it, or remove it.
//   npx github:nguyenhuuca/agentic-sdlc init [--dry-run] [--yes] [--packs a,b] [--with autopilot,evolve] [--target dir]
//   npx github:nguyenhuuca/agentic-sdlc update [--dry-run] [--yes] [--with ...]
//   npx github:nguyenhuuca/agentic-sdlc doctor
//   npx github:nguyenhuuca/agentic-sdlc uninstall [--dry-run] [--yes]
// Always runs: through npx the script is reached via a .bin shim, so an "am I the main module" check would fail.
import { main } from '../lib/cli.mjs'

main(process.argv.slice(2)).then((code) => process.exit(code))
