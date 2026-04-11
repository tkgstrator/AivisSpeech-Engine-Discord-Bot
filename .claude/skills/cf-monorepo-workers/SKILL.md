---
name: cf-monorepo-workers
description: Bun workspace monorepo pattern that boots a Vite + React frontend Worker together with multiple auxiliary Workers (API / DB) under one `vite dev` via the Cloudflare Vite Plugin. Covers the three-Worker layout using Hono + Service Bindings + D1 + Durable Objects so it can be reproduced in another repo.
---

# Cloudflare Monorepo + Vite Plugin + Auxiliary Workers

A Bun workspace monorepo pattern where a single Vite dev server boots the **frontend Worker and multiple backend Workers** at once. The frontend is a React SPA, the backend is wired with Hono + Service Bindings, and the DB Worker isolates Prisma + D1.

## Retrieval Sources

| Source | URL | Use for |
|--------|-----|---------|
| Cloudflare Vite Plugin | `https://developers.cloudflare.com/workers/vite-plugin/` | `cloudflare()` plugin options, `auxiliaryWorkers` |
| Workers static assets | `https://developers.cloudflare.com/workers/static-assets/` | `[assets]`, `run_worker_first`, SPA handling |
| Service bindings | `https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/` | Worker-to-Worker RPC |
| Wrangler config schema | `node_modules/wrangler/config-schema.json` | wrangler.toml fields |
| Vite Environment API | `https://vite.dev/guide/api-environment.html` | Background for per-environment plugin behaviour |

## When to Use

- You want to host a React (or any SPA) on Cloudflare Workers using `[assets]` + `run_worker_first`.
- You want the API Worker to ship as its own deployment, but develop locally in a single process (one `vite dev`).
- You want to isolate DB / Durable Object / external API calls in a dedicated Worker and call it via a Service Binding.
- When using Prisma (D1 adapter), you want only one Worker to touch D1, keeping responsibilities separate.

## Quick Reference

| Layer | Package | Role | Dev port |
|-------|---------|------|----------|
| Frontend + entry | `@org/app` (workers/app) | Vite + React SPA + Hono `/api/*` proxy | 3000 (Vite) / 8788 (Worker) |
| Backend API | `@org/api` (workers/api) | Hono routes, Durable Objects, KV | 8787 |
| Database | `@org/db` (workers/db) | Prisma + D1 only | 8686 |
| Shared types | `@org/shared` (packages/shared) | zod schemas, DTOs, utils | — |

## Required Packages

```bash
# Root
bun add -d @cloudflare/workers-types typescript wrangler

# workers/app (primary Worker)
bun add @cloudflare/vite-plugin hono react react-dom @org/shared
bun add -d vite @vitejs/plugin-react-swc @tailwindcss/vite

# workers/api (auxiliary Worker)
bun add hono @org/shared
bun add -d @cloudflare/workers-types

# workers/db (auxiliary Worker)
bun add @prisma/client @prisma/adapter-d1 prisma @org/shared
```

Do **not** install `vite` or `@cloudflare/vite-plugin` in the auxiliary Workers (`workers/api`, `workers/db`). The primary Worker's Vite handles them.

## Directory Layout

```
repo/
├── package.json            # Bun workspace root (workspaces: packages/*, workers/*)
├── tsconfig.json           # Shared base tsconfig (each workspace extends it)
├── packages/
│   └── shared/             # Shared types / zod schemas / utilities
│       └── package.json    # @org/shared (workspace:*)
└── workers/
    ├── app/                # ★ Primary Worker: React SPA + Hono (Vite is the entry)
    │   ├── vite.config.ts  # Declares @cloudflare/vite-plugin + auxiliaryWorkers
    │   ├── wrangler.toml   # [assets] + run_worker_first + [[services]] API_WORKER
    │   ├── tsconfig.json   # Project references (app + node)
    │   ├── tsconfig.app.json
    │   ├── tsconfig.node.json
    │   ├── plugins/resolve-path.ts  # Per-environment alias resolver plugin
    │   └── src/
    │       ├── index.ts    # Hono entry. Delegates /api/* via Service Binding
    │       └── app/        # React routes (TanStack Router)
    ├── api/                # Auxiliary Worker: Hono API + Durable Objects
    │   ├── wrangler.toml   # [[services]] DB_SERVICE + DO bindings
    │   └── src/index.ts
    └── db/                 # Auxiliary Worker: Prisma + D1 only
        ├── wrangler.toml   # [[d1_databases]]
        ├── prisma/schema.prisma
        └── src/index.ts
```

## Runtime Flow

1. `bun run dev` → `vite --host --port 3000` from `workers/app/package.json` starts.
2. `@cloudflare/vite-plugin` reads `workers/app/wrangler.toml` as the primary Worker and runs every wrangler.toml listed in `auxiliaryWorkers` as a child Worker inside the same miniflare instance.
3. Browser → Vite dev server → app Worker (Hono) → `c.env.API_WORKER.fetch()` (Service Binding) → API Worker → `c.env.DB_SERVICE.fetch()` → DB Worker → D1.
4. In production, `bun run deploy` runs `wrangler deploy` for each entry in `workers/*` individually.

## Root package.json

Defines the workspace and bundles deploy / typecheck scripts.

```json
{
  "name": "myapp",
  "private": true,
  "packageManager": "bun@1.3.9",
  "workspaces": ["packages/*", "workers/*"],
  "scripts": {
    "dev": "bun run --cwd workers/app dev",
    "build": "bun run --cwd workers/app build",
    "deploy": "bun --filter './workers/*' run deploy",
    "typecheck": "bun run --filter '@org/*' typecheck",
    "lint": "bunx biome check --write"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.x",
    "typescript": "^5.9",
    "wrangler": "^4.x"
  }
}
```

**Notes**
- `bun --filter './workers/*' run deploy` deploys every Worker in parallel; Bun resolves dependency order automatically.
- `dev` just invokes Vite inside `workers/app`; `@cloudflare/vite-plugin` handles the rest.
- `typecheck` uses the workspace filter to type-check every package at once.

## Root tsconfig.json (shared base)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  }
}
```

Each workspace does `"extends": "../../tsconfig.json"` and overrides `paths` / `types` locally (see below).

## packages/shared (Shared Types Package)

**package.json** — exposes source files directly via `exports`; no build step (bundlers read the TS).

```json
{
  "name": "@org/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./schemas/index.ts",
  "types": "./schemas/index.ts",
  "exports": {
    "./schemas/*.dto": "./schemas/*.dto.ts",
    "./schemas": "./schemas/index.ts",
    "./logger": "./logger.ts"
  }
}
```

**Consumer side**: add `"@org/shared": "workspace:*"` to `dependencies` and `import { x } from '@org/shared/schemas'` just works.

## workers/app (Primary Worker): Vite + React SPA + Hono Entry

### package.json

```json
{
  "name": "@org/app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "unset CLOUDFLARE_ENV && vite --host --port 3000",
    "build": "tsc -b && vite build --mode ${CLOUDFLARE_ENV:-staging}",
    "deploy": "bun wrangler deploy --config wrangler.toml --env=${CLOUDFLARE_ENV:-staging}",
    "typecheck": "tsc -b"
  },
  "dependencies": {
    "@cloudflare/vite-plugin": "^1.25.2",
    "@org/shared": "workspace:*",
    "@tailwindcss/vite": "^4.x",
    "@vitejs/plugin-react-swc": "^4.x",
    "hono": "^4.x",
    "react": "^19.x",
    "react-dom": "^19.x"
  },
  "devDependencies": {
    "vite": "^7.x",
    "typescript": "~5.9",
    "wrangler": "^4.x"
  }
}
```

**Important**
- `unset CLOUDFLARE_ENV` in `dev` prevents the Vite plugin from treating the run as a production build.
- `build` first runs `tsc -b` to type-check the project references, then `vite build`.

### vite.config.ts

```ts
import { resolve } from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import { resolvePath } from './plugins/resolve-path'

export default defineConfig({
  server: {
    allowedHosts: ['host.docker.internal', 'localhost:3000']
  },
  plugins: [
    // Custom plugin that switches `@/` resolution per Vite environment (see below).
    resolvePath([
      { find: '@/', replacement: resolve(__dirname, './src/') },
      {
        find: '@/',
        replacement: resolve(__dirname, '../api/src/'),
        environments: ['myapp_backend', 'myapp_backend_dev']
      }
    ]),
    tailwindcss(),
    react(),
    cloudflare({
      configPath: './wrangler.toml',
      // Consolidate every auxiliary Worker's miniflare state under the DB Worker so
      // Prisma CLI / `wrangler d1` commands and Vite all read the same .wrangler/state.
      persistState: { path: resolve(__dirname, '../db/.wrangler/state') },
      auxiliaryWorkers: [
        { configPath: resolve(__dirname, '../api/wrangler.toml') },
        { configPath: resolve(__dirname, '../db/wrangler.toml') }
      ],
      remoteBindings: false
    })
  ]
})
```

**Key points**
- Every `auxiliaryWorkers` entry runs under a **separate Vite environment name** (`<worker-name>_<env>`), not the primary Worker's environment. The Environment API treats them as distinct environments.
- `persistState` is the local store for D1 / KV / DO state. Pointing all auxiliary Workers at the same path keeps the D1 file that Prisma CLI writes and the one Vite reads in sync.
- `remoteBindings: false` keeps everything local.

### plugins/resolve-path.ts — Per-Environment Alias Resolution

When `auxiliaryWorkers` is enabled, the primary Worker's Vite also resolves child Worker sources (`workers/api/src/...`). An `@/foo` import inside the API Worker would normally resolve through Vite's global `resolve.alias` and break, because `@/` is wired to the primary Worker's `./src/`. This plugin splits the resolution per environment.

```ts
import { resolve } from 'node:path'
import type { Alias, Plugin } from 'vite'

type AliasEntry = Alias & { environments?: string[] }

export function resolvePath(aliases: AliasEntry[]): Plugin {
  // Evaluate environment-scoped entries first so they win.
  const sorted = [...aliases].sort((a, b) => {
    if (a.environments && !b.environments) return -1
    if (!a.environments && b.environments) return 1
    return 0
  })
  return {
    name: 'resolve-path',
    resolveId(source, importer, options) {
      const envName = this.environment?.name
      if (!envName) return
      for (const { find, replacement, environments } of sorted) {
        if (environments && !environments.includes(envName)) continue
        const findStr = typeof find === 'string' ? find : find.source
        const match = typeof find === 'string' ? source.startsWith(find) : find.test(source)
        if (match) {
          const resolved = resolve(replacement, source.slice(findStr.length))
          return this.resolve(resolved, importer, { ...options, skipSelf: true })
        }
      }
    }
  }
}
```

The environment name is assigned by `@cloudflare/vite-plugin` as `<worker-name>` or `<worker-name>_dev`. A `wrangler.toml` with `name = "myapp-backend"` becomes the Vite environment `myapp_backend` — **hyphens are rewritten to underscores**, so list the underscored form in the `environments` array.

### tsconfig.json (project references)

Use project references to separate `lib` / `types` for the Node side (vite.config.ts) and the app side (browser bundle).

```json
// tsconfig.json (root of workers/app)
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@org/shared/*": ["../../packages/shared/*"]
    }
  }
}
```

```json
// tsconfig.app.json (React + Worker runtime)
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["vite/client", "@cloudflare/workers-types", "@types/bun"],
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"],
      "@org/shared/*": ["../../packages/shared/*"]
    }
  },
  "include": ["src"]
}
```

```json
// tsconfig.node.json (only vite.config.ts is type-checked)
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

### wrangler.toml (Primary Worker)

```toml
name = "myapp-frontend"
compatibility_date = "2026-01-01"
compatibility_flags = ["nodejs_compat_v2"]
main = "src/index.ts"
keep_vars = true

[assets]
directory = "dist"
not_found_handling = "single-page-application"
binding = "ASSETS"
# Only /api/* hits the Worker (Hono) before static assets.
run_worker_first = ["/api/*"]

[[services]]
binding = "API_WORKER"
service = "myapp-backend"

[observability]
enabled = true

[dev]
port = 8788
ip = "0.0.0.0"
inspector_port = 9231

# Repeat the same structure per environment.
[env.staging]
name = "myapp-frontend-staging"
workers_dev = false
preview_urls = false
routes = [{ pattern = "app-dev.example.com", custom_domain = true }]

[env.staging.assets]
directory = "dist"
not_found_handling = "single-page-application"
binding = "ASSETS"
run_worker_first = ["/api/*"]

[[env.staging.services]]
binding = "API_WORKER"
service = "myapp-backend-staging"
```

**Critical: `run_worker_first = ["/api/*"]`**

Without it, a request to `/api/users` is served by `[assets]` first and falls back to `index.html` as a 404 → SPA redirect, never reaching the Hono route. This is the classic trap when co-hosting a SPA with an API.

### src/index.ts (Primary Worker entry)

```ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './lib/env'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors({ origin: ['http://localhost:3000'], credentials: true }))

// Forward /api/* to the API Worker via Service Binding.
app.all('/api/*', (c) => {
  if (!c.env.API_WORKER) return c.text('Service binding not available', 503)
  return c.env.API_WORKER.fetch(c.req.raw)
})

export default app
```

## workers/api (Auxiliary Worker): Hono + DO + KV

### package.json

```json
{
  "name": "@org/api",
  "private": true,
  "scripts": {
    "deploy": "bun wrangler deploy --config wrangler.toml --keep-vars --minify --env=${CLOUDFLARE_ENV:-staging}",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@org/shared": "workspace:*",
    "hono": "^4.x"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.x"
  }
}
```

`@cloudflare/vite-plugin` is **not needed** here — the primary Worker's Vite drives it. Don't install `vite` or a local `wrangler` either.

### tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@org/shared/*": ["../../packages/shared/*"]
    },
    "types": ["@cloudflare/workers-types", "@types/bun"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### wrangler.toml (API)

```toml
name = "myapp-backend"
main = "src/index.ts"
compatibility_date = "2026-01-01"
compatibility_flags = ["nodejs_compat_v2"]
tsconfig = "tsconfig.json"

[dev]
port = 8787
ip = "0.0.0.0"
inspector_port = 9229

[[services]]
binding = "DB_SERVICE"
service = "myapp-db"

[[kv_namespaces]]
binding = "PUBLIC_JWK_CACHE_KV"
id = "xxxxxxxx"

[[durable_objects.bindings]]
name = "MATCH"
class_name = "Match"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["Match"]

# Duplicate the same shape under env.staging / env.production.
```

## workers/db (Auxiliary Worker): Prisma + D1 Only

Called from the API Worker via a Service Binding. Putting the Prisma client in the API Worker would bloat the bundle, so it's isolated here.

### package.json

```json
{
  "name": "@org/db",
  "private": true,
  "scripts": {
    "generate": "bunx prisma generate",
    "migrate": "bun wrangler d1 migrations apply myapp-db --local --config wrangler.toml",
    "deploy": "bun wrangler deploy --config wrangler.toml --env=${CLOUDFLARE_ENV:-staging}",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@prisma/adapter-d1": "^7.x",
    "@prisma/client": "^7.x",
    "prisma": "^7.x"
  }
}
```

### wrangler.toml (DB)

```toml
name = "myapp-db"
main = "src/index.ts"
compatibility_date = "2026-01-01"
compatibility_flags = ["nodejs_compat"]
tsconfig = "tsconfig.json"

[dev]
port = 8686
inspector_port = 9230

[[d1_databases]]
binding = "DB"
database_name = "myapp-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[env.staging]
[[env.staging.d1_databases]]
binding = "DB"
database_name = "myapp-db-staging"
database_id = "..."
```

## Port Allocation

Assign fixed ports per Worker to avoid collisions:

| Worker | `[dev]` port | inspector_port |
| --- | --- | --- |
| workers/app (Vite runs separately on 3000) | 8788 | 9231 |
| workers/api | 8787 | 9229 |
| workers/db | 8686 | 9230 |

## Bootstrap Steps (Reproducing in a New Repo)

1. `bun init` the root and set `workspaces` to `["packages/*", "workers/*"]` in `package.json`.
2. Create the root `tsconfig.json` using the minimal shared base above.
3. Add the shared package under `packages/shared` so it is importable via `workspace:*`.
4. Scaffold `workers/app` from a Vite + React template (`bunx create-vite`).
5. `bun add -d @cloudflare/vite-plugin wrangler` and add `cloudflare({ ... })` to `vite.config.ts`.
6. Create `workers/api` and `workers/db` with just `wrangler.toml` + `src/index.ts` + `tsconfig.json`. Do **not** install `vite` or `@cloudflare/vite-plugin` there.
7. Register the api / db `wrangler.toml` paths in `workers/app/vite.config.ts` under `auxiliaryWorkers`, using absolute paths.
8. Add `run_worker_first = ["/api/*"]` and `[[services]] API_WORKER` to `workers/app/wrangler.toml`.
9. Add `[[services]] DB_SERVICE` to `workers/api/wrangler.toml`.
10. In `workers/app/src/index.ts`, forward `/api/*` to `env.API_WORKER.fetch()`.
11. Run `bun install && bun run dev`, open `http://localhost:3000`, and confirm that `/api/*` flows through api → db.

## Gotchas

- **`@/*` breaks inside child Workers** → Without the per-environment alias resolver (`plugins/resolve-path.ts`), `@/` inside api / db resolves to the primary Worker's `./src/` and the child Worker can't find its own sources.
- **`/api/*` falls back to the SPA 404** → `[assets].run_worker_first` is missing. It must be set together with `not_found_handling = "single-page-application"`.
- **Local D1 is empty from Prisma** → `persistState` is not aligned. The Vite plugin, `wrangler d1 execute --local`, and `prisma migrate` can all look at different `.wrangler/state` directories. Pin the Vite plugin's `persistState.path` to the DB Worker's state directory.
- **`CLOUDFLARE_ENV` contaminates dev** → Prefix the `dev` script with `unset CLOUDFLARE_ENV &&`. If it's set, the plugin skews toward a production bundling mode.
- **Deploy ordering** → `bun --filter './workers/*' run deploy` is parallel, but a Service Binding can fail if the target Worker doesn't exist yet. For the first deploy, run them sequentially: db → api → app.
- **Environment name rewriting** → A `wrangler.toml` with `name = "myapp-backend"` becomes the Vite environment `myapp_backend` (hyphens → underscores). Always write the underscored form in `resolvePath`'s `environments` array.
- **`tsc -b` fails on project references** → `tsconfig.app.json` and `tsconfig.node.json` must use distinct `tsBuildInfoFile` paths, otherwise they overwrite each other.
- **`compatibility_flags` mismatch** → Running the primary Worker on `nodejs_compat_v2` while the DB Worker stays on `nodejs_compat` depends on Prisma's compatibility. Keeping them aligned is safer, but drop the DB Worker to `nodejs_compat` when Prisma hasn't caught up.
