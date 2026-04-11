---
name: bun
description: Bun runtime conventions. Use when running commands, installing packages, or executing scripts in projects using Bun as the package manager.
user-invocable: false
---

# Bun Runtime Conventions

## Commands
- **Never use `npx` — always use `bunx`**
- Install packages with `bun add` / `bun add -d`
- Run scripts with `bun run <script>`
- Lock file is `bun.lock`

```bash
# NG
npx tsc --noEmit
npm install discord.js

# OK
bunx tsc --noEmit
bun add discord.js
```

## Testing
- Use `bun test` (never `node:test` or Jest directly)
- Import from `bun:test`
- Jest-compatible API (`describe`, `test`, `expect`, `mock`, `beforeAll`, etc.)
- File patterns: `*.test.ts`, `*_test.ts`, `*.spec.ts`

## Development
- `bun run --watch <file>` for auto-restart on file changes
- Flags must be placed immediately after `bun` (not after the script name)

```bash
# OK
bun --watch run src/index.ts

# NG (flag is passed to the script)
bun run src/index.ts --watch
```

## Bundler
- CLI: `bun build <entry> --outdir ./out`
- JS API: `await Bun.build({ entrypoints, outdir })`
- Targets: `browser`, `bun`, `node`