---
name: typescript
description: TypeScript coding conventions. Use when writing or reviewing TypeScript code. Covers strict mode, type inference from Zod schemas, type assertion restrictions, and import conventions.
user-invocable: false
---

# TypeScript Coding Conventions

## Compiler Settings
- `strict: true` with `strictNullChecks: true`
- `verbatimModuleSyntax`: use `import type` for type-only imports
- `noUncheckedIndexedAccess: true`

## Type Definitions
- **Do not write standalone `type` / `interface` — derive types from Zod schemas via `z.infer<>`**
- Inline type annotations are acceptable for cases where Zod is unnecessary (e.g. local variables)

## `as` Assertion Forbidden
- **`as` type assertions are forbidden** — fix the schema or logic instead
- `as const` is allowed

```typescript
// NG
const data = response as MyType

// OK
const data = MySchema.parse(response)
type MyType = z.infer<typeof MySchema>
const items = ['a', 'b', 'c'] as const
```

## `new Date()` Forbidden
- **Do not use `new Date()` — always use `dayjs`**

```typescript
// NG
const now = new Date()

// OK
import dayjs from 'dayjs'
const now = dayjs()
```