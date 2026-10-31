# Engine/Contract Separation — Phases 0–1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert softx-ecommerce to an npm-workspaces monorepo and extract the catalog domain (products, categories, promotional categories, hero slides) behind a versioned `@softx/contract` implemented by a new `@softx/engine`, with the Factory Bay UI switched onto it.

**Architecture:** The repo becomes a monorepo with the existing Next.js app at `apps/factorybay` and new packages `packages/contract` (service interfaces + zod DTOs, semver'd, namespace `v1`), `packages/engine` (implements the contract over the moved repositories), and `packages/engine-fixtures` (fake engine for UI work). Server actions stay as the app's only client-callable boundary and become thin wrappers over the engine. Spec: `docs/superpowers/specs/2026-10-31-engine-contract-separation-design.md`.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, npm workspaces (npm ≥10, Node 20), Neo4j (neo4j-driver), zod, vitest (new devDep), Playwright (new devDep), api-extractor (new devDep).

## Global Constraints

- Work happens on branch `engine-contract-separation`. Commit often; **never push** (the user pushes).
- Node 20 (`node:20-alpine` in Dockerfile); npm workspaces syntax only (no `workspace:` protocol — npm resolves `"*"`).
- **No new runtime dependencies in `apps/factorybay`.** New devDeps allowed: `vitest`, `@playwright/test`, `@microsoft/api-extractor`.
- Neo4j stores prices as major-unit numbers (`stockPrice: 2499`). Contract `Money` = `{ amountMinor: number (integer), currency: string (3) }`; conversion `Math.round(x * 100)`.
- Default currency `LKR`, overridable via env `DEFAULT_CURRENCY` on the engine.
- Every contract service method returns `Result<T, DomainError>`. Error codes are exactly: `NOT_FOUND | VALIDATION | CONFLICT | UNAUTHORIZED | UNAVAILABLE | UNKNOWN`.
- `@softx/contract` version starts at `1.0.0`; all v1 exports live under the `v1` namespace (`import { v1 } from '@softx/contract'`).
- Exported server-action function names in `apps/factorybay/src/app/actions/**` keep their exact names in Phase 1; their return envelopes keep the existing `{ success, ... }` shape (inner data types become DTOs).
- App path alias stays `@/*` → `./src/*` (relative to `apps/factorybury`… `apps/factorybay`). Cross-package imports always via package names `@softx/contract`, `@softx/engine`.
- `listProducts` default limit is **50** (parity with today's `getAllProducts`).
- Deprecated fields are **not** carried into DTOs: `Product.category`, `ProductVariant.images`, `ProductFilters.category`.
- Admin **write** actions (create/update/delete product, category, promo, hero slide) stay on their current repository internals (via the engine's `internal` export) until Phase 5. Only the storefront **read** path moves in Phase 1.
- Every task ends green: `npm run build` (root) plus that task's tests must pass before its commit.

---

### Task 1: Baseline — sync branch, restore stray file, verify build

**Files:**
- Modify: none (working-tree hygiene only)

**Interfaces:**
- Consumes: branch `engine-contract-separation` (exists, 1 commit ahead of local `master`, which is 6 behind `origin/master`)
- Produces: branch rebased on `origin/master`, clean working tree, verified build baseline

- [ ] **Step 1: Restore the stray deleted file**

The working tree has an unstaged deletion of `.playwright-mcp/GitHub-Deploy-Key-HBocpXmpsW8fEHFOfqVHZ-public-id-ed25519.pub`. Undo it (it is a tracked *public* key id file; deletion looks accidental and is out of scope):

```bash
cd /Volumes/Transcend/work-ssd/fleet/softx-ecommerce
git restore .playwright-mcp/GitHub-Deploy-Key-HBocpXmpsW8fEHFOfqVHZ-public-id-ed25519.pub
git status --porcelain   # expect: empty
```

- [ ] **Step 2: Sync with origin**

```bash
git fetch origin
git rebase origin/master   # our single docs commit replays on top
git log --oneline -3       # expect: docs commit on top of origin/master head
```

If the rebase conflicts inside `docs/`, keep both (`git checkout --theirs` never applies here — resolve manually; only our new spec file is ours).

- [ ] **Step 3: Verify baseline build**

```bash
npm ci
npm run build
```

Expected: build succeeds (exit 0). This is the "before" picture — if it fails, stop and report; do not proceed to Task 2 on a red baseline.

- [ ] **Step 4: No commit needed** (no changes produced).

---

### Task 2: Convert repo to npm workspaces; move app to `apps/factorybay`

**Files:**
- Create: root `package.json` (workspaces root), root `tsconfig.base.json`
- Move (git mv): `src` → `apps/factorybay/src`, `public` → `apps/factorybay/public`, `messages` → `apps/factorybay/messages`, `config` → `apps/factorybay/config`, `scripts` → `apps/factorybay/scripts`, `package.json` → `apps/factorybay/package.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `next-env.d.ts` → `apps/factorybay/`
- Modify: root `Dockerfile` (workspace-aware build), `setup.sh` (no change needed if root scripts delegate — verify), `CLAUDE.md` (command paths), `README.md` (structure)
- Keep at root: `Dockerfile`, `docker-compose.yml`, `Jenkinsfile`, `setup.sh`, docs

**Interfaces:**
- Consumes: Task 1 clean tree
- Produces: root `package.json` with `"workspaces": ["apps/*", "packages/*"]` and delegating scripts; `apps/factorybay/package.json` name `factorybay` (the app builds with `npm run build -w factorybay`)

- [ ] **Step 1: Create the workspaces root**

Root `package.json` (replace the existing file content after moving the old one):

```json
{
  "name": "softx-ecommerce",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev -w factorybay",
    "build": "npm run build -w factorybay",
    "start": "npm run start -w factorybay",
    "lint": "npm run lint -w factorybay",
    "db:init": "npm run db:init -w factorybay",
    "db:seed": "npm run db:seed -w factorybay",
    "db:clear": "npm run db:clear -w factorybay",
    "db:cleanup": "npm run db:cleanup -w factorybay",
    "setup:filters": "npm run setup:filters -w factorybay",
    "filters:setup": "npm run filters:setup -w factorybay",
    "filters:assign": "npm run filters:assign -w factorybay",
    "filters:init": "npm run filters:init -w factorybay",
    "filters:validate": "npm run filters:validate -w factorybay",
    "filters:recalculate": "npm run filters:recalculate -w factorybay",
    "filters:seed": "npm run filters:seed -w factorybay",
    "seed:hero-slides": "npm run seed:hero-slides -w factorybay",
    "minio:init": "npm run minio:init -w factorybay",
    "setup:categories": "npm run setup:categories -w factorybay"
  }
}
```

Root `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true
  }
}
```

- [ ] **Step 2: Move the app**

```bash
mkdir -p apps/factorybay
git mv src apps/factorybay/src
git mv public apps/factorybay/public
git mv messages apps/factorybay/messages
git mv config apps/factorybay/config
git mv scripts apps/factorybay/scripts
git mv package.json apps/factorybay/package.json
git mv next.config.ts apps/factorybay/next.config.ts
git mv tailwind.config.ts apps/factorybay/tailwind.config.ts
git mv postcss.config.mjs apps/factorybay/postcss.config.mjs
git mv tsconfig.json apps/factorybay/tsconfig.json
git mv next-env.d.ts apps/factorybay/next-env.d.ts 2>/dev/null || true
```

`apps/factorybay/package.json`: keep everything, only change `"name"` stays `"factory-bay"` → **rename to `"factorybay"`** (workspace-friendly; `-w factorybay` targets it). Keep `package-lock.json` at root (it becomes the workspace lock — regenerated next step).

Fix relative imports inside moved scripts: `apps/factorybay/scripts/*.ts` import `'../src/lib/...'` — `src` moved with them, so relative paths still resolve. Verify:

```bash
grep -rn "from '\.\./src" apps/factorybay/scripts | head   # paths unchanged relative to scripts dir — still valid
```

`apps/factorybay/tsconfig.json`: add `"extends": "../../tsconfig.base.json"`, and keep app-specific keys (`jsx`, `plugins`, `paths`, `include`). Full file:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Reinstall and build from root**

```bash
rm -rf node_modules
npm install          # regenerates package-lock.json with workspaces
npm run build
```

Expected: build succeeds. `npm run dev` must also boot (`setup.sh` uses it) — spot check with `timeout 20 npm run dev` and look for "Ready" in output, then kill.

- [ ] **Step 4: Update root Dockerfile for workspaces**

The image builds from repo root (kamal config points here — do not move it). Replace the deps/builder stages' copy logic:

```dockerfile
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/factorybay/package.json ./apps/factorybay/
RUN npm ci
```

(builder stage — after `COPY . .` nothing else changes; the build command already runs in `/app` where root `npm run build` delegates to the workspace)

And the runner stage standalone copies become:

```dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/apps/factorybay/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/factorybay/.next/static ./apps/factorybay/.next/static
```

plus, next to the existing `public`/`messages` copies:

```dockerfile
COPY --from=builder /app/apps/factorybay/public ./apps/factorybay/public
COPY --from=builder /app/apps/factorybay/messages ./apps/factorybay/messages
```

(delete the old `COPY --from=builder /app/public ./public` and `/app/messages ./messages` lines — `output: "standalone"` preserves the `apps/factorybay` prefix internally.)

- [ ] **Step 5: Verify Docker build**

```bash
docker build -t softx-ecommerce:workspaces-check \
  --build-arg NEXT_PUBLIC_MINIO_URL=http://localhost:9000 \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 .
```

Expected: image builds; then clean up: `docker rmi softx-ecommerce:workspaces-check`.

- [ ] **Step 6: Update docs paths**

In `CLAUDE.md` and `README.md`: no command changes needed (root scripts delegate), but add one line under the overview: "Monorepo: the Next.js app lives in `apps/factorybay`; shared packages live in `packages/*` (contract, engine). Build/deploy from the repo root." Fix any doc sections that hardcode `src/...` paths → `apps/factorybay/src/...` (grep `src/lib` in both files).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: convert repo to npm workspaces, move app to apps/factorybay"
```

---

### Task 3: Scaffold packages + vitest

**Files:**
- Create: `packages/contract/package.json`, `packages/contract/tsconfig.json`, `packages/contract/src/index.ts` (placeholder re-export)
- Create: `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/src/index.ts` (placeholder)
- Create: `packages/engine-fixtures/package.json`, `packages/engine-fixtures/tsconfig.json`, `packages/engine-fixtures/src/index.ts` (placeholder)
- Modify: root `package.json` (test scripts + devDeps)

**Interfaces:**
- Produces: importable `@softx/contract`, `@softx/engine`, `@softx/engine-fixtures` (empty index modules); `npm run test` at root runs vitest across all workspaces

- [ ] **Step 1: Install tooling at root**

```bash
npm install -D vitest
```

Root `package.json` scripts — add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Root `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
  },
})
```

- [ ] **Step 2: Create the three packages**

`packages/contract/package.json`:

```json
{
  "name": "@softx/contract",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run" },
  "dependencies": { "zod": "^3.24.1" }
}
```

`packages/contract/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src/**/*.ts"]
}
```

`packages/engine/package.json` — same shape, name `@softx/engine`, extra deps `"neo4j-driver": "^5.26.0"`, `"@softx/contract": "*"`.
`packages/engine-fixtures/package.json` — same shape, name `@softx/engine-fixtures`, dep `"@softx/contract": "*"`.
Their `tsconfig.json` files: identical to contract's. Each `src/index.ts`:

```ts
export const packageName = '@softx/contract' // respectively '@softx/engine', '@softx/engine-fixtures'
```

**Also update the root `Dockerfile` deps stage** — `npm ci` at the workspaces root needs every workspace manifest, so extend the copies added in Task 2:

```dockerfile
COPY package.json package-lock.json ./
COPY apps/factorybay/package.json ./apps/factorybay/
COPY packages/contract/package.json ./packages/contract/
COPY packages/engine/package.json ./packages/engine/
COPY packages/engine-fixtures/package.json ./packages/engine-fixtures/
RUN npm ci
```

(Future packages must be added here too — the build fails loudly if you forget.)

- [ ] **Step 3: Smoke test the wiring**

`packages/contract/src/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { packageName } from './index'

describe('@softx/contract scaffold', () => {
  it('is importable', () => {
    expect(packageName).toBe('@softx/contract')
  })
})
```

Run: `npm test`
Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold @softx/contract, @softx/engine, @softx/engine-fixtures + vitest"
```

---

### Task 4: Contract v1 core primitives (Result, DomainError, Money, PagedResult)

**Files:**
- Create: `packages/contract/src/v1/core/result.ts`, `packages/contract/src/v1/core/money.ts`, `packages/contract/src/v1/core/paged.ts`
- Create: `packages/contract/src/v1/index.ts`, `packages/contract/src/index.ts`
- Test: `packages/contract/src/v1/core/money.test.ts`

**Interfaces:**
- Produces (under `v1`):
  - `type ErrorCode = 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'UNAUTHORIZED' | 'UNAVAILABLE' | 'UNKNOWN'`
  - `interface DomainError { code: ErrorCode; message: string; details?: Record<string, unknown> }`
  - `type Result<T> = { ok: true; data: T } | { ok: false; error: DomainError }`
  - `ok<T>(data: T): Result<T>`, `err(code: ErrorCode, message: string, details?): Result<never>`
  - `Money = { amountMinor: number; currency: string }`, `money(amountMinor: number, currency: string): Money`, `fromMajorAmount(value: number, currency: string): Money`
  - `PagedResult<T> = { items: T[]; total: number; limit: number; offset: number }`

- [ ] **Step 1: Write failing tests for money**

`packages/contract/src/v1/core/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { money, fromMajorAmount } from './money'

describe('money', () => {
  it('builds from minor units', () => {
    expect(money(249000, 'LKR')).toEqual({ amountMinor: 249000, currency: 'LKR' })
  })

  it('converts major-unit floats safely', () => {
    expect(fromMajorAmount(2499, 'LKR').amountMinor).toBe(249900)
    expect(fromMajorAmount(2499.99, 'LKR').amountMinor).toBe(249999)
    expect(fromMajorAmount(0.1 + 0.2, 'LKR').amountMinor).toBe(30)
  })

  it('rejects non-integer minor units', () => {
    expect(() => money(1.5, 'LKR')).toThrow(/integer/)
  })
})
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test`
Expected: FAIL — `Cannot find module './money'`.

- [ ] **Step 3: Implement**

`packages/contract/src/v1/core/money.ts`:

```ts
import { z } from 'zod'

export const MoneySchema = z.object({
  amountMinor: z.number().int(),
  currency: z.string().length(3),
})
export type Money = z.infer<typeof MoneySchema>

export function money(amountMinor: number, currency: string): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`money(): amountMinor must be an integer, got ${amountMinor}`)
  }
  return { amountMinor, currency }
}

export function fromMajorAmount(value: number, currency: string): Money {
  return money(Math.round(value * 100), currency)
}
```

`packages/contract/src/v1/core/result.ts`:

```ts
export type ErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'UNAVAILABLE'
  | 'UNKNOWN'

export interface DomainError {
  code: ErrorCode
  message: string
  details?: Record<string, unknown>
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: DomainError }

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function err(code: ErrorCode, message: string, details?: Record<string, unknown>): Result<never> {
  return { ok: false, error: details ? { code, message, details } : { code, message } }
}
```

`packages/contract/src/v1/core/paged.ts`:

```ts
export interface PagedResult<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}
```

`packages/contract/src/v1/index.ts`:

```ts
export * from './core/result'
export * from './core/money'
export * from './core/paged'
```

`packages/contract/src/index.ts`:

```ts
export * as v1 from './v1'
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/contract
git commit -m "feat(contract): v1 core primitives — Result, DomainError, Money, PagedResult"
```

---

### Task 5: Catalog DTOs

**Files:**
- Create: `packages/contract/src/v1/catalog/product.dto.ts`, `category.dto.ts`, `promotional-category.dto.ts`, `hero-slide.dto.ts`
- Modify: `packages/contract/src/v1/index.ts`
- Test: `packages/contract/src/v1/catalog/dto.test.ts`

**Interfaces:**
- Produces (under `v1`): `ProductVariantDTO`, `ProductDTO`, `CategoryDTO`, `CategoryTreeDTO`, `PromotionalCategoryDTO`, `HeroSlideDTO` (+ their zod schemas) and query type `ListProductsQuery`
- Field mapping (repository → DTO): `stockPrice`/`retailPrice` (number, major units) → `price: { stock: Money; retail: Money }`; drop `Product.category`, `ProductVariant.images`; everything else 1:1

- [ ] **Step 1: Write failing schema tests**

`packages/contract/src/v1/catalog/dto.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ProductSchema } from './product.dto'
import { money } from '../core/money'

const validProduct = {
  id: 'p1',
  name: 'Premium Tee',
  description: 'A tee',
  brand: 'Acme',
  gender: 'UNISEX',
  sku: 'ACME-TEE-1',
  price: { stock: money(249900, 'LKR'), retail: money(299900, 'LKR') },
  images: ['http://localhost:9000/product-images/a.webp'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  variants: [
    { id: 'v1', size: 'M', color: 'Black', stockQuantity: 5 },
  ],
}

describe('ProductSchema', () => {
  it('accepts a valid product', () => {
    expect(ProductSchema.safeParse(validProduct).success).toBe(true)
  })

  it('rejects a product with no variants key', () => {
    const { variants, ...noVariants } = validProduct
    expect(ProductSchema.safeParse(noVariants).success).toBe(false)
  })

  it('rejects non-integer money', () => {
    const bad = { ...validProduct, price: { stock: { amountMinor: 1.5, currency: 'LKR' }, retail: money(0, 'LKR') } }
    expect(ProductSchema.safeParse(bad).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test` → FAIL (module not found).

- [ ] **Step 3: Implement the DTOs**

`packages/contract/src/v1/catalog/product.dto.ts`:

```ts
import { z } from 'zod'
import { MoneySchema } from '../core/money'

export const ProductGenderSchema = z.enum(['MEN', 'WOMEN', 'UNISEX'])
export const SizeOptionSchema = z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL'])

export const ProductVariantSchema = z.object({
  id: z.string(),
  size: SizeOptionSchema,
  color: z.string(),
  stockQuantity: z.number().int(),
})
export type ProductVariantDTO = z.infer<typeof ProductVariantSchema>

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  brand: z.string(),
  gender: ProductGenderSchema,
  sku: z.string(),
  price: z.object({ stock: MoneySchema, retail: MoneySchema }),
  images: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  variants: z.array(ProductVariantSchema),
})
export type ProductDTO = z.infer<typeof ProductSchema>

export const ListProductsQuerySchema = z.object({
  brand: z.string().optional(),
  gender: ProductGenderSchema.optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(200).default(50),
  offset: z.number().int().nonnegative().default(0),
})
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>
```

`packages/contract/src/v1/catalog/category.dto.ts`:

```ts
import { z } from 'zod'

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  hierarchy: z.string(),
  parentId: z.string().nullable(),
  level: z.number().int(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  productCount: z.number().int().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type CategoryDTO = z.infer<typeof CategorySchema>

export type CategoryTreeDTO = CategoryDTO & { children: CategoryTreeDTO[] }
```

`packages/contract/src/v1/catalog/promotional-category.dto.ts`:

```ts
import { z } from 'zod'

export const PromotionalCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  displayOrder: z.number().int(),
  isActive: z.boolean(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type PromotionalCategoryDTO = z.infer<typeof PromotionalCategorySchema>
```

`packages/contract/src/v1/catalog/hero-slide.dto.ts` (field values verbatim from `apps/factorybay/src/lib/types.ts:161-194` — `CustomPanelStyle` copied exactly):

```ts
import { z } from 'zod'

export const HeroAnimationTypeSchema = z.enum(['left-panel', 'top-left-round', 'top-right-panel', 'bottom-right-quarter'])
export const HeroMobileAnimationTypeSchema = z.enum(['bottom-pill', 'bottom-full-panel', 'top-banner', 'center-card'])
export const HeroColorThemeSchema = z.enum(['light', 'dark', 'custom'])

export const CustomPanelStyleSchema = z.object({
  textColor: z.string(),
  panelColor: z.string(),
  panelOpacity: z.number(),
  borderEnabled: z.boolean(),
  borderColor: z.string(),
  borderOpacity: z.number(),
  borderWidth: z.number(),
})
export type CustomPanelStyleDTO = z.infer<typeof CustomPanelStyleSchema>

export const HeroSlideSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  mobileImageUrl: z.string().optional(),
  animationType: HeroAnimationTypeSchema,
  mobileAnimationType: HeroMobileAnimationTypeSchema.optional(),
  colorTheme: HeroColorThemeSchema,
  mobileColorTheme: HeroColorThemeSchema.optional(),
  customDesktopStyle: CustomPanelStyleSchema.optional(),
  customMobileStyle: CustomPanelStyleSchema.optional(),
  badgeText: z.string(),
  title: z.string(),
  subtitle: z.string(),
  linkUrl: z.string().optional(),
  displayOrder: z.number().int(),
  isActive: z.boolean(),
})
export type HeroSlideDTO = z.infer<typeof HeroSlideSchema>
```

Add to `packages/contract/src/v1/index.ts`:

```ts
export * from './catalog/product.dto'
export * from './catalog/category.dto'
export * from './catalog/promotional-category.dto'
export * from './catalog/hero-slide.dto'
```

- [ ] **Step 4: Run tests**

Run: `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contract
git commit -m "feat(contract): v1 catalog DTOs — product, category, promo category, hero slide"
```

---

### Task 6: `CatalogService` interface + conformance suite + fixture world

**Files:**
- Create: `packages/contract/src/v1/catalog/catalog.service.ts`
- Create: `packages/contract/src/testing/catalog-world.ts` (shared fixture entities + cypher seed), `packages/contract/src/testing/catalog-conformance.ts` (the suite)
- Modify: `packages/contract/src/index.ts` (export `testing`), `packages/contract/package.json` (export `./testing`)
- Test: the conformance suite is itself the test — wired up in Tasks 7/9

**Interfaces:**
- Produces (under `v1`):

```ts
export interface CatalogService {
  listProducts(query?: Partial<ListProductsQuery>): Promise<Result<PagedResult<ProductDTO>>>
  getProduct(id: string): Promise<Result<ProductDTO>>
  searchProducts(term: string): Promise<Result<ProductDTO[]>>
  listBrands(): Promise<Result<string[]>>
  listProductsByCategories(categoryIds: string[]): Promise<Result<ProductDTO[]>>
  getCategory(id: string): Promise<Result<CategoryDTO>>
  getCategoryTree(): Promise<Result<CategoryTreeDTO[]>>
  listPromotionalCategories(includeInactive?: boolean): Promise<Result<PromotionalCategoryDTO[]>>
  getPromotionalCategoryBySlug(slug: string): Promise<Result<PromotionalCategoryDTO>>
  listProductsByPromotionalCategory(categoryId: string): Promise<Result<ProductDTO[]>>
  listHeroSlides(activeOnly?: boolean): Promise<Result<HeroSlideDTO[]>>
}
```

- Produces (under `testing`): `catalogWorld` (fixture entities + `seedCypher` + `teardownCypher`), `runCatalogConformance(suiteName: string, makeService: () => v1.CatalogService)`

- [ ] **Step 1: Define the interface**

`packages/contract/src/v1/catalog/catalog.service.ts`:

```ts
import type { Result } from '../core/result'
import type { PagedResult } from '../core/paged'
import type { ProductDTO, ListProductsQuery } from './product.dto'
import type { CategoryDTO, CategoryTreeDTO } from './category.dto'
import type { PromotionalCategoryDTO } from './promotional-category.dto'
import type { HeroSlideDTO } from './hero-slide.dto'

export interface CatalogService {
  listProducts(query?: Partial<ListProductsQuery>): Promise<Result<PagedResult<ProductDTO>>>
  getProduct(id: string): Promise<Result<ProductDTO>>
  searchProducts(term: string): Promise<Result<ProductDTO[]>>
  listBrands(): Promise<Result<string[]>>
  listProductsByCategories(categoryIds: string[]): Promise<Result<ProductDTO[]>>
  getCategory(id: string): Promise<Result<CategoryDTO>>
  getCategoryTree(): Promise<Result<CategoryTreeDTO[]>>
  listPromotionalCategories(includeInactive?: boolean): Promise<Result<PromotionalCategoryDTO[]>>
  getPromotionalCategoryBySlug(slug: string): Promise<Result<PromotionalCategoryDTO>>
  listProductsByPromotionalCategory(categoryId: string): Promise<Result<ProductDTO[]>>
  listHeroSlides(activeOnly?: boolean): Promise<Result<HeroSlideDTO[]>>
}
```

Add to `packages/contract/src/v1/index.ts`: `export * from './catalog/catalog.service'`.

- [ ] **Step 2: Define the fixture world**

`packages/contract/src/testing/catalog-world.ts` — one source of truth for entities, used by BOTH the fake engine and the real-engine integration seed:

```ts
import { money, type ProductDTO, type CategoryDTO, type PromotionalCategoryDTO, type HeroSlideDTO } from '../v1'

export const worldCurrency = 'LKR'

export const worldProducts: ProductDTO[] = [
  {
    id: 'conformance-p1',
    name: 'Conformance Classic Tee',
    description: 'Fixture product one',
    brand: 'Acme',
    gender: 'UNISEX',
    sku: 'CONF-TEE-1',
    price: { stock: money(249900, worldCurrency), retail: money(299900, worldCurrency) },
    images: ['http://minio.test/product-images/tee.webp'],
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    variants: [
      { id: 'conformance-v1', size: 'M', color: 'Black', stockQuantity: 5 },
      { id: 'conformance-v2', size: 'L', color: 'White', stockQuantity: 0 },
    ],
  },
  {
    id: 'conformance-p2',
    name: 'Conformance Hoodie',
    description: 'Fixture product two',
    brand: 'Boralus',
    gender: 'MEN',
    sku: 'CONF-HOOD-1',
    price: { stock: money(499900, worldCurrency), retail: money(599900, worldCurrency) },
    images: ['http://minio.test/product-images/hoodie.webp'],
    createdAt: '2026-01-01T00:00:00.000Z', // older — ordering matters for listProducts assertions
    updatedAt: '2026-01-01T00:00:00.000Z',
    variants: [{ id: 'conformance-v3', size: 'XL', color: 'Grey', stockQuantity: 2 }],
  },
]

export const worldCategories: CategoryDTO[] = [
  {
    id: 'conformance-c1', name: 'Tops', slug: 'tops', hierarchy: 'conformance',
    parentId: null, level: 0, isActive: true, isFeatured: true,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

export const worldPromoCategory: PromotionalCategoryDTO = {
  id: 'conformance-promo1', name: 'Conformance Sale', slug: 'conformance-sale',
  description: 'fixture promo', displayOrder: 1, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}

export const worldHeroSlides: HeroSlideDTO[] = [
  {
    id: 'conformance-h1', imageUrl: 'http://minio.test/hero/1.webp',
    animationType: 'left-panel', colorTheme: 'light',
    badgeText: 'New', title: 'Conformance Slide 1', subtitle: 'sub', displayOrder: 1, isActive: true,
  },
  {
    id: 'conformance-h2', imageUrl: 'http://minio.test/hero/2.webp',
    animationType: 'top-left-round', colorTheme: 'dark',
    badgeText: 'Old', title: 'Conformance Slide 2', subtitle: 'sub2', displayOrder: 2, isActive: false,
  },
]
```

- [ ] **Step 3: Define the conformance suite**

`packages/contract/src/testing/catalog-conformance.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { v1 } from '../v1'
import { worldProducts, worldCategories, worldPromoCategory, worldHeroSlides } from './catalog-world'

export function runCatalogConformance(
  suiteName: string,
  makeService: () => v1.CatalogService,
) {
  describe(`${suiteName}: CatalogService v1 conformance`, () => {
    it('listProducts returns newest-first with totals', async () => {
      const r = await makeService().listProducts()
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.data.total).toBe(worldProducts.length)
      expect(r.data.items.map((p) => p.id)).toEqual(['conformance-p1', 'conformance-p2']) // createdAt DESC
      expect(() => v1.ProductSchema.parse(r.data.items[0])).not.toThrow()
    })

    it('listProducts filters by brand', async () => {
      const r = await makeService().listProducts({ brand: 'Boralus' })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.items.map((p) => p.id)).toEqual(['conformance-p2'])
    })

    it('listProducts limit+offset page', async () => {
      const r = await makeService().listProducts({ limit: 1, offset: 1 })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.items.map((p) => p.id)).toEqual(['conformance-p2'])
    })

    it('getProduct returns the product', async () => {
      const r = await makeService().getProduct('conformance-p1')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.variants).toHaveLength(2)
    })

    it('getProduct unknown id → NOT_FOUND', async () => {
      const r = await makeService().getProduct('does-not-exist')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.code).toBe('NOT_FOUND')
    })

    it('searchProducts matches name case-insensitively', async () => {
      const r = await makeService().searchProducts('hoodie')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.map((p) => p.id)).toEqual(['conformance-p2'])
    })

    it('listBrands returns distinct brands', async () => {
      const r = await makeService().listBrands()
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.sort()).toEqual(['Acme', 'Boralus'])
    })

    it('getCategory returns the category', async () => {
      const r = await makeService().getCategory('conformance-c1')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.slug).toBe('tops')
    })

    it('getCategoryTree returns tree nodes', async () => {
      const r = await makeService().getCategoryTree()
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.some((c) => c.id === 'conformance-c1')).toBe(true)
    })

    it('getPromotionalCategoryBySlug resolves', async () => {
      const r = await makeService().getPromotionalCategoryBySlug('conformance-sale')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.id).toBe('conformance-promo1')
    })

    it('listHeroSlides activeOnly filters', async () => {
      const all = await makeService().listHeroSlides()
      const active = await makeService().listHeroSlides(true)
      expect(all.ok && active.ok).toBe(true)
      if (all.ok) expect(all.data).toHaveLength(2)
      if (active.ok) expect(active.data.map((s) => s.id)).toEqual(['conformance-h1'])
    })
  })
}
```

(If, while implementing the engine, an assertion contradicts documented current behavior, fix the assertion in this task's file — never silently in one runner only.)

Export from the package. `packages/contract/src/index.ts` becomes:

```ts
export * as v1 from './v1'
export * as testing from './testing'
```

`packages/contract/src/testing/index.ts`:

```ts
export * from './catalog-world'
export * from './catalog-conformance'
```

`packages/contract/package.json` `exports`:

```json
"exports": { ".": "./src/index.ts", "./testing": "./src/testing/index.ts" }
```

- [ ] **Step 4: Typecheck and commit**

```bash
npm test   # still green (suite not yet wired to a runner)
npx tsc -p packages/contract/tsconfig.json --noEmit
git add packages/contract
git commit -m "feat(contract): CatalogService v1 interface + shared conformance suite and fixture world"
```

---

### Task 7: Engine scaffold — move repositories + types, tenant-aware db

**Files:**
- Move (git mv): `apps/factorybay/src/lib/repositories` → `packages/engine/src/repositories`; `apps/factorybay/src/lib/db.ts` → `packages/engine/src/db.ts`; `apps/factorybay/src/lib/neo4j-utils.ts` → `packages/engine/src/neo4j-utils.ts`; `apps/factorybay/src/lib/types.ts` → `packages/engine/src/types.ts`
- Create: `packages/engine/src/index.ts`, `packages/engine/src/engine.ts`
- Modify: every app file importing `@/lib/types`, `@/lib/repositories/*`, `@/lib/db`, `@/lib/neo4j-utils` (mechanical import rewrite)
- Test: `packages/engine/src/engine.test.ts`

**Interfaces:**
- Produces:
  - `@softx/engine` exports `v1` types re-export + `internal` namespace: `{ types, repositories, db, neo4jUtils }` (migration escape hatch — deleted in Phase 5)
  - `createEngine(config: EngineConfig): Engine`; `Engine.for(tenant: TenantRef): TenantEngine`; `TenantEngine.catalog: v1.CatalogService`
  - `EngineConfig = { neo4j: { uri: string; user: string; password: string; database?: string }; defaultCurrency?: string }` (defaults from `NEO4J_URI`/`NEO4J_USER`/`NEO4J_PASSWORD`/`NEO4J_DATABASE` env; `defaultCurrency` from `DEFAULT_CURRENCY`, fallback `'LKR'`)

- [ ] **Step 1: Move the files**

```bash
mkdir -p packages/engine/src
git mv apps/factorybay/src/lib/repositories packages/engine/src/repositories
git mv apps/factorybay/src/lib/db.ts packages/engine/src/db.ts
git mv apps/factorybay/src/lib/neo4j-utils.ts packages/engine/src/neo4j-utils.ts
git mv apps/factorybay/src/lib/types.ts packages/engine/src/types.ts
```

`apps/factorybay/src/lib/` keeps: `auth.ts`, `color-utils.ts`, `guest-cart.ts`, `minio.ts`, `schema.ts` (Phase 2+ moves).

- [ ] **Step 2: Fix imports inside the engine package**

In `packages/engine/src/**`: rewrite `from '../db'` → `from '../db'` (already relative — but repositories sit one level deeper now: they imported `../db`, `../types`, `../neo4j-utils`; after the move the relative layout is identical, so most imports are already correct). Check and fix only these two patterns:

```bash
grep -rn "from '@/lib" packages/engine/src    # expect none; if found, rewrite to relative paths
grep -rn "from '../neo4j-utils'\|from '../types'" packages/engine/src/repositories | head
```

`packages/engine/src/db.ts` — make sessions tenant-aware. Replace `getSession` with:

```ts
export function getSession(database?: string): Session {
  return getDriver().session(database ? { database } : undefined)
}
```

and in `runQuery`, accept an optional database parameter the same way:

```ts
export async function runQuery<T = any>(
  query: string,
  params: Record<string, any> = {},
  database?: string
): Promise<T[]> {
  const session = getSession(database)
  try {
    const result = await session.run(query, params)
    return result.records.map((record) => record.toObject() as T)
  } finally {
    await session.close()
  }
}
```

(Repositories keep calling `getSession()` — zero-arg default `undefined` targets the server default database, exactly today's behavior. The engine passes the tenant database explicitly in Task 8.)

- [ ] **Step 3: Engine module**

`packages/engine/src/engine.ts`:

```ts
import type { v1 } from '@softx/contract'

export interface EngineConfig {
  neo4j: {
    uri: string
    user: string
    password: string
    /** Neo4j database name; defaults to env NEO4J_DATABASE or the server default */
    database?: string
  }
  /** ISO-4217 code used when mapping prices; default env DEFAULT_CURRENCY or 'LKR' */
  defaultCurrency?: string
}

export interface TenantRef {
  clientId: string
}

export interface TenantEngine {
  readonly catalog: v1.CatalogService
}

export interface Engine {
  for(tenant: TenantRef): TenantEngine
}

export function createEngine(config: EngineConfig): Engine {
  const engine: Engine = {
    for(tenant: TenantRef): TenantEngine {
      return {
        get catalog(): v1.CatalogService {
          return createCatalogService(config, tenant)
        },
      }
    },
  }
  return engine
}

/** Read EngineConfig from environment (used by apps and scripts). */
export function engineConfigFromEnv(): EngineConfig {
  return {
    neo4j: {
      uri: process.env.NEO4J_URI || 'neo4j://localhost:7687',
      user: process.env.NEO4J_USER || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password',
      database: process.env.NEO4J_DATABASE || undefined,
    },
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'LKR',
  }
}
```

This imports `./catalog`, which does not exist yet — create the Task 8 stub **now**, in this step, as `packages/engine/src/catalog.ts` (Task 8 replaces its body):

```ts
import type { v1 } from '@softx/contract'
import type { EngineConfig, TenantRef } from './engine'

export function createCatalogService(_config: EngineConfig, _tenant: TenantRef): v1.CatalogService {
  throw new Error('catalog service implemented in Task 8')
}
```

`packages/engine/src/index.ts`:

```ts
import * as types from './types'
import * as repositories from './repositories'
import * as db from './db'
import * as neo4jUtils from './neo4j-utils'

export { createEngine, engineConfigFromEnv } from './engine'
export type { Engine, EngineConfig, TenantEngine, TenantRef } from './engine'

/**
 * @internal Migration escape hatch for code not yet on the contract
 * (admin write actions, cart/checkout, scripts). Removed in Phase 5.
 */
export const internal = { types, repositories, db, neo4jUtils }
```

`packages/engine/src/repositories/index.ts` (create):

```ts
export * as productRepository from './product.repository'
export * as categoryRepository from './category.repository'
export * as promotionalCategoryRepository from './promotional-category.repository'
export * as heroSlideRepository from './hero-slide.repository'
export * as cartRepository from './cart.repository'
export * as orderRepository from './order.repository'
export * as userRepository from './user.repository'
export * as userProfileRepository from './user-profile.repository'
export * as colorRepository from './color.repository'
export * as browsingHistoryRepository from './browsing-history.repository'
export * as recommendationRepository from './recommendation.repository'
```

- [ ] **Step 4: Rewrite app imports mechanically**

App dependency (add to `apps/factorybay/package.json` `"dependencies"`): `"@softx/contract": "*"`, `"@softx/engine": "*"`.

```bash
cd apps/factorybay
grep -rl "@/lib/types\|@/lib/repositories\|@/lib/db\|@/lib/neo4j-utils" src scripts | while read -r f; do
  sed -i '' \
    -e "s|from '@/lib/types'|from '@softx/engine'|g" \
    -e "s|from '@/lib/db'|from '@softx/engine'|g" \
    -e "s|from '@/lib/neo4j-utils'|from '@softx/engine'|g" \
    -e "s|from '@/lib/repositories/\([a-z.-]*\)'|from '@softx/engine'|g" \
    "$f"
done
```

**Important:** after the sed, files that imported a repository's named export (`import { getAllProducts } from '@/lib/repositories/product.repository'`) now import it from `'@softx/engine'` — but those names live under `internal.repositories`. To keep this task compiling, re-export the repository modules' named exports flat from the engine index as well. Add to `packages/engine/src/index.ts`:

```ts
// Flat re-exports for not-yet-migrated imports (removed in Phase 5)
export * from './types'
export { getDriver, getSession, closeDriver, runQuery, testConnection } from './db'
export * from './repositories/product.repository'
export * from './repositories/category.repository'
export * from './repositories/promotional-category.repository'
export * from './repositories/hero-slide.repository'
export * from './repositories/cart.repository'
export * from './repositories/order.repository'
export * from './repositories/user.repository'
export * from './repositories/user-profile.repository'
export * from './repositories/color.repository'
export * from './repositories/browsing-history.repository'
export * from './repositories/recommendation.repository'
```

Also fix relative imports in `apps/factorybay/scripts/*.ts` that used `'../src/lib/db'` etc.:

```bash
grep -rln "src/lib/db\|src/lib/types\|src/lib/repositories" apps/factorybay/scripts | while read -r f; do
  sed -i '' -e "s|from '\.\./src/lib/db'|from '@softx/engine'|g" \
            -e "s|from '\.\./src/lib/types'|from '@softx/engine'|g" \
            -e "s|from '\.\./src/lib/repositories/[a-z-]*'|from '@softx/engine'|g" "$f"
done
```

Then verify no stragglers: `grep -rn "@/lib/types\|@/lib/repositories\|@/lib/db\|src/lib/db" apps/factorybay/src apps/factorybay/scripts` → expect empty.

- [ ] **Step 5: Engine scaffold test**

`packages/engine/src/engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createEngine, engineConfigFromEnv } from './engine'

describe('createEngine', () => {
  it('builds a tenant engine per tenant', () => {
    const engine = createEngine({
      neo4j: { uri: 'neo4j://localhost:7687', user: 'neo4j', password: 'x' },
      defaultCurrency: 'LKR',
    })
    const t1 = engine.for({ clientId: 'factorybay' })
    expect(t1.catalog).toBeDefined()
    const t2 = engine.for({ clientId: 'other' })
    expect(t2).not.toBe(t1)
  })

  it('engineConfigFromEnv defaults currency to LKR', () => {
    expect(engineConfigFromEnv().defaultCurrency).toBe('LKR')
  })
})
```

Run: `npm test` → engine scaffold tests PASS (the `catalog` stub from Step 3 throws only when a method is actually called, which these tests don't do).

- [ ] **Step 6: App build green**

```bash
npm run build
```

Expected: success. (Types moved packages but names/paths resolve through the flat re-exports.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): engine scaffold, tenant-aware db, repositories+types moved into @softx/engine"
```

---

### Task 8: Catalog mappers + `CatalogService` implementation

**Files:**
- Create: `packages/engine/src/mappers/catalog.mapper.ts`, `packages/engine/src/catalog.ts` (replaces stub)
- Test: `packages/engine/src/mappers/catalog.mapper.test.ts`

**Interfaces:**
- Consumes: `internal.repositories` functions — `getAllProducts(filters, limit)`, `getProductById(id)`, `searchProducts(query)`, `getAllBrands()`, `getProductCount(filters)`, `getFullProductsByCategories(ids)`, `getCategoryById(id)`, `getCategoryTree()`, `getAllPromotionalCategories(includeInactive?)`, `getPromotionalCategoryBySlug(slug)`, `getProductsByCategory(id)`, hero-slide repo's list function (check exact name in `hero-slide.repository.ts` — likely `getAllHeroSlides(includeInactive?)`)
- Produces: `createCatalogService(config: EngineConfig, tenant: TenantRef): v1.CatalogService` (same signature as the Task 7 stub), plus mapper `toProductDTO(p: ProductWithVariants, currency: string): ProductDTO`, `toCategoryDTO`, `toPromotionalCategoryDTO`, `toHeroSlideDTO`

- [ ] **Step 1: Write failing mapper tests**

`packages/engine/src/mappers/catalog.mapper.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toProductDTO } from './catalog.mapper'

const repoProduct = {
  id: 'p1', name: 'Tee', description: 'd', brand: 'Acme', gender: 'UNISEX',
  stockPrice: 2499.99, retailPrice: 2999, sku: 'S1',
  images: ['http://x/1.webp'],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  variants: [{ id: 'v1', productId: 'p1', size: 'M', color: 'Black', stockQuantity: 5, images: ['old'] }],
}

describe('toProductDTO', () => {
  it('maps prices to Money in minor units', () => {
    const dto = toProductDTO(repoProduct as never, 'LKR')
    expect(dto.price.stock).toEqual({ amountMinor: 249999, currency: 'LKR' })
    expect(dto.price.retail).toEqual({ amountMinor: 299900, currency: 'LKR' })
  })

  it('drops deprecated fields (category, variant images)', () => {
    const dto = toProductDTO({ ...repoProduct, category: 'SHIRT' } as never, 'LKR')
    expect(dto).not.toHaveProperty('category')
    expect(dto.variants[0]).not.toHaveProperty('images')
    expect(dto.variants[0]).not.toHaveProperty('productId')
  })
})
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test` → FAIL (`./catalog.mapper` missing).

- [ ] **Step 3: Implement mappers**

`packages/engine/src/mappers/catalog.mapper.ts`:

```ts
import { fromMajorAmount, type ProductDTO, type CategoryDTO, type PromotionalCategoryDTO, type HeroSlideDTO } from '@softx/contract'
import type { ProductWithVariants, Category, PromotionalCategory, HeroSlide } from '../types'

export function toProductDTO(p: ProductWithVariants, currency: string): ProductDTO {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    brand: p.brand,
    gender: p.gender,
    sku: p.sku,
    price: { stock: fromMajorAmount(p.stockPrice, currency), retail: fromMajorAmount(p.retailPrice, currency) },
    images: p.images,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    variants: p.variants.map((v) => ({
      id: v.id, size: v.size, color: v.color, stockQuantity: v.stockQuantity,
    })),
  }
}

export function toCategoryDTO(c: Category): CategoryDTO {
  return {
    id: c.id, name: c.name, slug: c.slug, hierarchy: c.hierarchy,
    parentId: c.parentId ?? null, level: c.level, isActive: c.isActive,
    isFeatured: c.isFeatured,
    ...(c.productCount !== undefined ? { productCount: c.productCount } : {}),
    createdAt: c.createdAt, updatedAt: c.updatedAt,
  }
}

export function toPromotionalCategoryDTO(pc: PromotionalCategory): PromotionalCategoryDTO {
  return {
    id: pc.id, name: pc.name, slug: pc.slug,
    ...(pc.description !== undefined ? { description: pc.description } : {}),
    displayOrder: pc.displayOrder, isActive: pc.isActive,
    ...(pc.startDate ? { startDate: pc.startDate } : {}),
    ...(pc.endDate ? { endDate: pc.endDate } : {}),
    createdAt: pc.createdAt, updatedAt: pc.updatedAt,
  }
}

export function toHeroSlideDTO(s: HeroSlide): HeroSlideDTO {
  return {
    id: s.id,
    imageUrl: s.imageUrl,
    ...(s.mobileImageUrl ? { mobileImageUrl: s.mobileImageUrl } : {}),
    animationType: s.animationType,
    ...(s.mobileAnimationType ? { mobileAnimationType: s.mobileAnimationType } : {}),
    colorTheme: s.colorTheme,
    ...(s.mobileColorTheme ? { mobileColorTheme: s.mobileColorTheme } : {}),
    ...(s.customDesktopStyle ? { customDesktopStyle: s.customDesktopStyle } : {}),
    ...(s.customMobileStyle ? { customMobileStyle: s.customMobileStyle } : {}),
    badgeText: s.badgeText, title: s.title, subtitle: s.subtitle,
    ...(s.linkUrl ? { linkUrl: s.linkUrl } : {}),
    displayOrder: s.displayOrder, isActive: s.isActive,
  }
}
```

- [ ] **Step 4: Implement the service**

Replace the body of `packages/engine/src/catalog.ts` (the stub from Task 7):

```ts
import { ok, err, type v1 } from '@softx/contract'
import type { EngineConfig, TenantRef } from './engine'
import { toProductDTO, toCategoryDTO, toPromotionalCategoryDTO, toHeroSlideDTO } from './mappers/catalog.mapper'
import * as productRepo from './repositories/product.repository'
import * as categoryRepo from './repositories/category.repository'
import * as promoRepo from './repositories/promotional-category.repository'
import * as heroRepo from './repositories/hero-slide.repository'

export function createCatalogService(config: EngineConfig, _tenant: TenantRef): v1.CatalogService {
  const currency = config.defaultCurrency ?? 'LKR'

  return {
    async listProducts(query = {}) {
      try {
        const limit = query.limit ?? 50
        const offset = query.offset ?? 0
        const filters = {
          ...(query.brand !== undefined ? { brand: query.brand } : {}),
          ...(query.gender !== undefined ? { gender: query.gender } : {}),
          ...(query.minPrice !== undefined ? { minPrice: query.minPrice } : {}),
          ...(query.maxPrice !== undefined ? { maxPrice: query.maxPrice } : {}),
          ...(query.search !== undefined ? { search: query.search } : {}),
        }
        const [all, total] = await Promise.all([
          productRepo.getAllProducts(
            Object.keys(filters).length > 0 ? filters : undefined,
            limit + offset
          ),
          productRepo.getProductCount(Object.keys(filters).length > 0 ? filters : undefined),
        ])
        const items = all.slice(offset, offset + limit).map((p) => toProductDTO(p, currency))
        return ok({ items, total, limit, offset })
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list products', { cause: String(e) })
      }
    },

    async getProduct(id) {
      try {
        const p = await productRepo.getProductById(id)
        return p ? ok(toProductDTO(p, currency)) : err('NOT_FOUND', `Product ${id} not found`)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to get product', { cause: String(e) })
      }
    },

    async searchProducts(term) {
      try {
        const products = await productRepo.searchProducts(term)
        return ok(products.map((p) => toProductDTO(p, currency)))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to search products', { cause: String(e) })
      }
    },

    async listBrands() {
      try {
        return ok(await productRepo.getAllBrands())
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list brands', { cause: String(e) })
      }
    },

    async listProductsByCategories(categoryIds) {
      try {
        const products = await categoryRepo.getFullProductsByCategories(categoryIds)
        return ok(products.map((p) => toProductDTO(p, currency)))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list products by categories', { cause: String(e) })
      }
    },

    async getCategory(id) {
      try {
        const c = await categoryRepo.getCategoryById(id)
        return c ? ok(toCategoryDTO(c)) : err('NOT_FOUND', `Category ${id} not found`)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to get category', { cause: String(e) })
      }
    },

    async getCategoryTree() {
      try {
        const tree = await categoryRepo.getCategoryTree()
        const mapTree = (c: categoryRepo.CategoryTree): v1.CategoryTreeDTO => ({
          ...toCategoryDTO(c),
          children: c.children.map(mapTree),
        })
        return ok(tree.map(mapTree))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to get category tree', { cause: String(e) })
      }
    },

    async listPromotionalCategories(includeInactive = false) {
      try {
        const cats = await promoRepo.getAllPromotionalCategories(includeInactive)
        return ok(cats.map(toPromotionalCategoryDTO))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list promotional categories', { cause: String(e) })
      }
    },

    async getPromotionalCategoryBySlug(slug) {
      try {
        const c = await promoRepo.getPromotionalCategoryBySlug(slug)
        return c ? ok(toPromotionalCategoryDTO(c)) : err('NOT_FOUND', `Promotional category ${slug} not found`)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to get promotional category', { cause: String(e) })
      }
    },

    async listProductsByPromotionalCategory(categoryId) {
      try {
        const products = await promoRepo.getProductsByCategory(categoryId)
        return ok((products ?? []).map((p) => toProductDTO(p, currency)))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list products by promo category', { cause: String(e) })
      }
    },

    async listHeroSlides(activeOnly = false) {
      try {
        const slides = await heroRepo.getAllHeroSlides(!activeOnly)
        return ok(slides.map(toHeroSlideDTO))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to list hero slides', { cause: String(e) })
      }
    },
  }
}
```

**Before finalizing:** open each repository file and verify the exact function names/signatures used above (`getAllProducts`, `getProductCount`, `searchProducts`, `getAllBrands`, `getFullProductsByCategories`, `getCategoryById`, `getCategoryTree`, `getAllPromotionalCategories`, `getPromotionalCategoryBySlug`, `getProductsByCategory`, `getAllHeroSlides`). If a name or argument differs (e.g. hero repo takes `includeInactive` vs `activeOnly`, or returns `{slides, error}`), adapt the call site to the repository's real signature — the *service* signature above is the contract and must not change. `getProductsByCategory` in the promo repo returns `Promise<ProductWithVariants[]>` via `runQuery` — confirm and adjust if it returns an envelope.

- [ ] **Step 5: Run tests**

Run: `npm test` → mapper tests + scaffold tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): catalog mappers + CatalogService v1 implementation"
```

---

### Task 9: `engine-fixtures` — fake engine passing the conformance suite

**Files:**
- Create: `packages/engine-fixtures/src/fake-catalog.ts`, `packages/engine-fixtures/src/fake-engine.ts`, `packages/engine-fixtures/src/index.ts`
- Test: `packages/engine-fixtures/src/fake-catalog.conformance.test.ts`

**Interfaces:**
- Produces: `createFakeEngine(): FakeEngine` where `FakeEngine = { for(tenant: { clientId: string }): { catalog: v1.CatalogService } }`

- [ ] **Step 1: Implement the fake catalog**

`packages/engine-fixtures/src/fake-catalog.ts` — serves the `catalogWorld` entities in memory:

```ts
import { ok, err, testing, type v1 } from '@softx/contract'

export function createFakeCatalogService(): v1.CatalogService {
  const products = [...testing.worldProducts]
  const categories = [...testing.worldCategories]
  const promo = { ...testing.worldPromoCategory }
  const slides = [...testing.worldHeroSlides]

  const matchesQuery = (p: v1.ProductDTO, q: Partial<v1.ListProductsQuery>) =>
    (q.brand === undefined || p.brand === q.brand) &&
    (q.gender === undefined || p.gender === q.gender) &&
    (q.search === undefined || p.name.toLowerCase().includes(q.search.toLowerCase()))

  return {
    async listProducts(query = {}) {
      const limit = query.limit ?? 50
      const offset = query.offset ?? 0
      const filtered = products
        .filter((p) => matchesQuery(p, query))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return ok({ items: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset })
    },
    async getProduct(id) {
      const p = products.find((x) => x.id === id)
      return p ? ok(p) : err('NOT_FOUND', `Product ${id} not found`)
    },
    async searchProducts(term) {
      return ok(products.filter((p) => p.name.toLowerCase().includes(term.toLowerCase())))
    },
    async listBrands() {
      return ok([...new Set(products.map((p) => p.brand))])
    },
    async listProductsByCategories() {
      return ok(products)
    },
    async getCategory(id) {
      const c = categories.find((x) => x.id === id)
      return c ? ok(c) : err('NOT_FOUND', `Category ${id} not found`)
    },
    async getCategoryTree() {
      return ok(categories.map((c) => ({ ...c, children: [] })))
    },
    async listPromotionalCategories() {
      return ok([promo])
    },
    async getPromotionalCategoryBySlug(slug) {
      return promo.slug === slug ? ok(promo) : err('NOT_FOUND', `Promotional category ${slug} not found`)
    },
    async listProductsByPromotionalCategory() {
      return ok(products)
    },
    async listHeroSlides(activeOnly = false) {
      return ok(activeOnly ? slides.filter((s) => s.isActive) : slides)
    },
  }
}
```

`packages/engine-fixtures/src/fake-engine.ts`:

```ts
import type { v1 } from '@softx/contract'
import { createFakeCatalogService } from './fake-catalog'

export interface FakeEngine {
  for(_tenant: { clientId: string }): { catalog: v1.CatalogService }
}

export function createFakeEngine(): FakeEngine {
  return { for: () => ({ catalog: createFakeCatalogService() }) }
}
```

`packages/engine-fixtures/src/index.ts`:

```ts
export { createFakeEngine } from './fake-engine'
export type { FakeEngine } from './fake-engine'
export { createFakeCatalogService } from './fake-catalog'
```

- [ ] **Step 2: Wire the conformance suite to the fake**

`packages/engine-fixtures/src/fake-catalog.conformance.test.ts`:

```ts
import { testing } from '@softx/contract'
import { createFakeCatalogService } from './fake-catalog'

testing.runCatalogConformance('engine-fixtures', () => createFakeCatalogService())
```

Run: `npm test`
Expected: conformance suite (11 tests) PASSES against the fake.

- [ ] **Step 3: Commit**

```bash
git add packages/engine-fixtures
git commit -m "feat(engine-fixtures): fake engine passing catalog conformance suite"
```

---

### Task 10: Real-engine conformance run (integration)

**Files:**
- Create: `packages/engine/test/catalog.integration.test.ts`, `packages/engine/test/helpers/seed.ts`

**Interfaces:**
- Consumes: `runCatalogConformance`, `catalogWorld`, `createEngine`
- Produces: `npm run test:integration` at root — runs only when `RUN_INTEGRATION=1`; seeds+tears down the world fixtures via Cypher

- [ ] **Step 1: Seed helpers**

`packages/engine/test/helpers/seed.ts` — writes/reads the DTO world in graph form. Prices are stored major-unit (2499.99 → `stockPrice: 2499.99`):

```ts
import type { Driver } from 'neo4j-driver'

export async function seedWorld(driver: Driver, database?: string): Promise<void> {
  const session = driver.session(database ? { database } : undefined)
  try {
    await session.run(
      `
      CREATE (p1:Product {id: 'conformance-p1', name: 'Conformance Classic Tee', description: 'Fixture product one',
        brand: 'Acme', gender: 'UNISEX', stockPrice: 2499.0, retailPrice: 2999.0, sku: 'CONF-TEE-1',
        images: ['http://minio.test/product-images/tee.webp'],
        createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z'})
      CREATE (p2:Product {id: 'conformance-p2', name: 'Conformance Hoodie', description: 'Fixture product two',
        brand: 'Boralus', gender: 'MEN', stockPrice: 4999.0, retailPrice: 5999.0, sku: 'CONF-HOOD-1',
        images: ['http://minio.test/product-images/hoodie.webp'],
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'})
      CREATE (p1)-[:HAS_VARIANT]->(:ProductVariant {id: 'conformance-v1', productId: 'conformance-p1', size: 'M', color: 'Black', stockQuantity: 5, images: []})
      CREATE (p1)-[:HAS_VARIANT]->(:ProductVariant {id: 'conformance-v2', productId: 'conformance-p1', size: 'L', color: 'White', stockQuantity: 0, images: []})
      CREATE (p2)-[:HAS_VARIANT]->(:ProductVariant {id: 'conformance-v3', productId: 'conformance-p2', size: 'XL', color: 'Grey', stockQuantity: 2, images: []})
      CREATE (:Category {id: 'conformance-c1', name: 'Tops', slug: 'tops', hierarchy: 'conformance',
        parentId: null, level: 0, isActive: true, isFeatured: true,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'})
      CREATE (:PromotionalCategory {id: 'conformance-promo1', name: 'Conformance Sale', slug: 'conformance-sale',
        description: 'fixture promo', displayOrder: 1, isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'})
      CREATE (:HeroSlide {id: 'conformance-h1', imageUrl: 'http://minio.test/hero/1.webp',
        animationType: 'left-panel', colorTheme: 'light', badgeText: 'New', title: 'Conformance Slide 1',
        subtitle: 'sub', displayOrder: 1, isActive: true})
      CREATE (:HeroSlide {id: 'conformance-h2', imageUrl: 'http://minio.test/hero/2.webp',
        animationType: 'top-left-round', colorTheme: 'dark', badgeText: 'Old', title: 'Conformance Slide 2',
        subtitle: 'sub2', displayOrder: 2, isActive: false})
      `
    )
  } finally {
    await session.close()
  }
}

export async function teardownWorld(driver: Driver, database?: string): Promise<void> {
  const session = driver.session(database ? { database } : undefined)
  try {
    await session.run(
      `MATCH (n) WHERE n.id STARTS WITH 'conformance-' DETACH DELETE n`
    )
  } finally {
    await session.close()
  }
}
```

**Before finalizing:** check the real relationship type between `Product` and `ProductVariant` (`VARIANT_OF` — variant points at product: `(v:ProductVariant)-[:VARIANT_OF]->(p)` per `product.repository.ts:80`) and adjust the seed's `CREATE` pattern to match exactly: variants must relate with `-[:VARIANT_OF]->`. The snippet above uses `HAS_VARIANT` in the wrong direction — fix it to:

```cypher
CREATE (v1:ProductVariant {…})-[:VARIANT_OF]->(p1)
```

Also verify the real node labels (`Category`, `PromotionalCategory`, `HeroSlide`) against the repository Cypher before running — if a label differs, fix the seed, not the repositories.

- [ ] **Step 2: Integration test**

`packages/engine/test/catalog.integration.test.ts`:

```ts
import { beforeAll, afterAll } from 'vitest'
import neo4j from 'neo4j-driver'
import { testing } from '@softx/contract'
import { createEngine, engineConfigFromEnv, type Engine } from '../src/engine'
import { seedWorld, teardownWorld } from './helpers/seed'

const RUN = process.env.RUN_INTEGRATION === '1'

describe.skipIf(!RUN)('real engine: catalog conformance', () => {
  let engine: Engine
  let driver: ReturnType<typeof neo4j.driver>

  beforeAll(async () => {
    const config = engineConfigFromEnv()
    engine = createEngine(config)
    driver = neo4j.driver(config.neo4j.uri, neo4j.auth.basic(config.neo4j.user, config.neo4j.password))
    await seedWorld(driver, config.neo4j.database)
  })

  afterAll(async () => {
    const config = engineConfigFromEnv()
    await teardownWorld(driver, config.neo4j.database)
    await driver.close()
  })

  testing.runCatalogConformance('real-engine', () => engine.for({ clientId: 'conformance' }).catalog)
})
```

Root `package.json` — add script:

```json
"test:integration": "RUN_INTEGRATION=1 vitest run --include 'packages/engine/test/**/*.test.ts'"
```

Also widen root `vitest.config.ts` `include` to `['packages/*/src/**/*.test.ts', 'packages/*/test/**/*.test.ts']`.

- [ ] **Step 3: Run against local infra**

```bash
docker compose up -d          # Neo4j + MinIO
RUN_INTEGRATION=1 npx vitest run packages/engine/test/catalog.integration.test.ts
```

Expected: 11 conformance tests PASS against the real engine. Failures here are engine bugs or seed/world mismatches — fix the engine (or seed), never weaken an assertion without checking current behavior is genuinely different and updating the shared suite for BOTH runners.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(engine): real-engine catalog conformance run + graph seed helpers"
```

---

### Task 11: Switch the app's catalog read path onto the engine

**Files:**
- Create: `apps/factorybay/src/lib/engine.ts` (app singleton)
- Modify: `apps/factorybay/src/app/actions/products.ts`, `categories.ts`, `hero-slides.ts`, `promotional-categories.ts` (read functions only)
- Modify (price/shape sites): `apps/factorybay/src/components/products/ProductCard.tsx`, `src/components/SearchAutocomplete.tsx`, `src/app/[locale]/product/[id]/ProductDetailClient.tsx`, `src/app/[locale]/HomePageClient.tsx`, `HomePageClientProgressive.tsx`, `HomePageClientSimple.tsx`, `src/app/[locale]/shop/page.tsx`, `src/app/[locale]/admin/products/AdminProductsClient.tsx`, `src/app/[locale]/admin/sections/PromotionalCategoriesClient.tsx`
- Create: `apps/factorybay/src/lib/price.ts`
- Test: Task 12's smoke test verifies the result

**Interfaces:**
- Consumes: `createEngine`, `engineConfigFromEnv`, `v1` DTOs
- Produces: app engine singleton `getEngine(): Engine`; action envelopes unchanged in *name and success/error shape*, inner data now DTOs; price helper `amount(money): number` and `formatPrice(money): string`

- [ ] **Step 1: App engine singleton + price helpers**

`apps/factorybay/src/lib/engine.ts`:

```ts
import { createEngine, engineConfigFromEnv, type Engine } from '@softx/engine'

let engine: Engine | null = null

export function getEngine(): Engine {
  if (!engine) {
    engine = createEngine(engineConfigFromEnv())
  }
  return engine
}

export function getCatalog() {
  return getEngine().for({ clientId: process.env.CLIENT_ID || 'factorybay' }).catalog
}
```

`apps/factorybay/src/lib/price.ts`:

```ts
import type { v1 } from '@softx/contract'

/** Money → major-unit number, for rendering exactly where the old number was rendered. */
export function amount(m: v1.Money): number {
  return m.amountMinor / 100
}

/** Money → "LKR 24.99" style string using the currency code. */
export function formatPrice(m: v1.Money): string {
  return `${m.currency} ${amount(m).toFixed(2)}`
}
```

- [ ] **Step 2: Rewrite read actions as wrappers**

`apps/factorybay/src/app/actions/products.ts` — full replacement:

```ts
'use server'

import { getCatalog } from '@/lib/engine'

export async function getProductsAction(
  filters?: Partial<{ brand: string; gender: 'MEN' | 'WOMEN' | 'UNISEX'; minPrice: number; maxPrice: number; search: string }>
) {
  const r = await getCatalog().listProducts(filters)
  if (!r.ok) {
    console.error('Get products error:', r.error)
    return { success: false as const, products: [], count: 0, error: r.error.message }
  }
  return { success: true as const, products: r.data.items, count: r.data.total }
}

export async function getProductAction(id: string) {
  const r = await getCatalog().getProduct(id)
  if (!r.ok) {
    return { success: false as const, product: null, error: r.error.message }
  }
  return { success: true as const, product: r.data }
}

export async function searchProductsAction(query: string) {
  const r = await getCatalog().searchProducts(query)
  if (!r.ok) {
    return { success: false as const, products: [], error: r.error.message }
  }
  return { success: true as const, products: r.data }
}

export async function getBrandsAction() {
  const r = await getCatalog().listBrands()
  if (!r.ok) {
    return { success: false as const, brands: [], error: r.error.message }
  }
  return { success: true as const, brands: r.data }
}
```

Same treatment in the other three action files — for each **read** function, replace the repository call with the engine call and keep the envelope. Function-by-function mapping:

| Old function (keep name) | Engine call | Envelope keeps |
|---|---|---|
| `getRootCategoriesAction()` | `getCategoryTree()` → take roots (level 0 / parentId null) | `{ success, categories }` |
| `getCategoryTreeAction()` | `getCategoryTree()` | `{ success, tree }` |
| `getCategoriesByHierarchyAction(h)` | `getCategoryTree()` → filter `hierarchy === h` recursively | `{ success, categories }` |
| `getCategoryByIdAction(id)` | `getCategory(id)` | `{ success, category }` |
| `getChildCategoriesAction(parentId)` | `getCategoryTree()` → find node, return `children` mapped via `toCategoryDTO` shape (already DTO) | `{ success, categories }` |
| `getChildCategoriesWithDescendantCountsAction(parentId)` | `getCategoryTree()` → children (+ `productCount` if present on DTO) | `{ success, categories }` |
| `getFullProductsByCategoriesAction(ids)` | `listProductsByCategories(ids)` | `{ success, data }` |
| `getProductsByCategoriesAction(...)` (if distinct) | `listProductsByCategories(ids)` | same envelope as before |
| `getAllPromotionalCategoriesAction(includeInactive?)` | `listPromotionalCategories(includeInactive)` | `{ success, categories }` (check current key name and keep it) |
| `getPromotionalCategoryByIdAction(id)` | engine has no by-id — call `listPromotionalCategories(true)` and find by id | current envelope |
| `getPromotionalCategoryBySlugAction(slug)` | `getPromotionalCategoryBySlug(slug)` | current envelope |
| `getProductsByCategoryAction(categoryId)` | `listProductsByPromotionalCategory(categoryId)` | `{ success, data }` |
| `getAllHeroSlidesAction(includeInactive?)` | `listHeroSlides(!includeInactive)` | `{ success, slides }` (check key name) |

**Write functions in these files stay untouched** — they now import repositories from `@softx/engine` (already handled by Task 7's flat re-exports).

- [ ] **Step 3: Update consumer type imports**

```bash
cd apps/factorybay
grep -rln "ProductWithVariants\|from '@/lib/repositories/product.repository'" src | while read -r f; do
  sed -i '' -e "s|import type { ProductWithVariants } from '@softx/engine'|import type { v1 } from '@softx/contract'|g" "$f"
done
```

Then manually, in each file that used the `ProductWithVariants` type, change the type reference to `v1.ProductDTO` (they are aliased imports — rewrite the alias: `import type { ProductWithVariants } …` → `import type { v1 } from '@softx/contract'` and `ProductWithVariants` → `v1.ProductDTO`). Same for `Category` → `v1.CategoryDTO`, `HeroSlide` → `v1.HeroSlideDTO`, `PromotionalCategory` → `v1.PromotionalCategoryDTO` **where the value flows from the read actions** (files using these types for *write* payloads keep importing them from `@softx/engine` — they are the repository types and unchanged).

- [ ] **Step 4: Fix price/shape usage sites**

Enumerate exactly:

```bash
grep -rn "stockPrice\|retailPrice" apps/factorybay/src/components apps/factorybay/src/app --include="*.tsx" | grep -v admin/ProductFormDialog
```

Apply these exact transformations (cart/order/checkout files use cart-domain prices, not product DTOs — leave them; Phase 2 handles those):

- `product.stockPrice` → `amount(product.price.stock)` (add `import { amount } from '@/lib/price'`)
- `product.retailPrice` → `amount(product.price.retail)`
- `variant.images` (if referenced for display) → `product.images`
- any `product.category` read → delete the read (field no longer exists; the shop-category flow goes through `?category=<id>` query + `listProductsByCategories`, never through the product field)

- [ ] **Step 5: Build + grep-verify**

```bash
npm run build
grep -rn "stockPrice\|retailPrice" apps/factorybay/src/components apps/factorybay/src/app --include="*.tsx" \
  | grep -v "admin/ProductFormDialog" | grep -v "CartItem\|CheckoutPageClient"
```

Expected: build success; grep empty (cart/checkout/admin-form sites allowed until their phases).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(app): catalog read path switched to @softx/engine contract services"
```

---

### Task 12: Playwright smoke + contract API snapshot gate + Jenkins checks + docs

**Files:**
- Create: `apps/factorybay/playwright.config.ts`, `apps/factorybay/e2e/smoke.spec.ts`, `apps/factorybay/.gitignore` addition (`test-results/`, `playwright-report/`)
- Create: `packages/contract/api-extractor.json`, `packages/contract/etc/` (committed snapshot)
- Modify: root `package.json` (scripts `test:smoke`, `audit:api`), root `Jenkinsfile` (checks stage), `CLAUDE.md`

**Interfaces:**
- Produces: `npm run audit:api` (fails if contract's public API changed without updating the snapshot), `npm run test:smoke` (Playwright), Jenkins runs checks before deploy

- [ ] **Step 1: Playwright smoke**

```bash
npm install -D -w factorybay @playwright/test
npx playwright install chromium
```

`apps/factorybay/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: process.env.SMOKE_BASE_URL || 'http://localhost:3000' },
  webServer: process.env.SMOKE_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120_000 },
})
```

`apps/factorybay/e2e/smoke.spec.ts` (requires seeded infra — `./setup.sh start`, `npm run db:init && npm run db:seed`):

```ts
import { test, expect } from '@playwright/test'

test('shop lists seeded products', async ({ page }) => {
  await page.goto('/en/shop')
  await expect(page.locator('main, body').first()).toBeVisible()
  await expect(page.getByRole('link', { name: /premium|shirt|tee|hoodie/i }).first()).toBeVisible()
})

test('product detail renders a price', async ({ page }) => {
  await page.goto('/en/shop')
  const card = page.getByRole('link', { name: /premium|shirt|tee|hoodie/i }).first()
  await card.click()
  await expect(page.getByText(/LKR|Rs/i).first()).toBeVisible()
})
```

Root `package.json` script: `"test:smoke": "npm run test:smoke -w factorybay"`; app script: `"test:smoke": "playwright test"`.

Run (with infra up): `npm run test:smoke` → PASS.

- [ ] **Step 2: Contract API snapshot gate**

```bash
npm install -D -w @softx/contract @microsoft/api-extractor
```

`packages/contract/api-extractor.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json",
  "mainEntryPointFilePath": "src/index.ts",
  "dtsRollup": { "enabled": true, "untrimmedFilePath": "" , "publicTrimmedFilePath": "", "alphaTrimmedFilePath": "" },
  "apiReport": { "enabled": true, "reportFolder": "etc/", "reportTempFolder": "etc/temp/" },
  "docModel": { "enabled": false },
  "tsdocMetadata": { "enabled": false },
  "messages": {
    "compilerMessageReporting": { "default": { "logLevel": "error" } },
    "extractorMessageReporting": { "default": { "logLevel": "error" }, "ae-missing-release-tag": { "logLevel": "none" } },
    "tsdocMessageReporting": { "default": { "logLevel": "none" } }
  }
}
```

Contract script: `"audit:api": "api-extractor run --local"`. First run creates `etc/@softx-contract.api.md` — commit it. Root script: `"audit:api": "npm run audit:api -w @softx/contract"`.

Gate check:

```bash
npm run audit:api
git diff --exit-code -- packages/contract/etc
```

Expected: clean. (A diff means the public API changed — additive additions are reviewed and committed deliberately; removals/renames are breaking and need a new major per the spec.)

- [ ] **Step 3: Jenkins checks stage**

`Jenkinsfile` — wrap the existing `deployKamalApp(...)` call:

```groovy
stage('checks') {
    steps {
        sh 'npm ci && npm run build && npm test && npm run audit:api && git diff --exit-code -- packages/contract/etc'
    }
}

deployKamalApp(
    // ... existing arguments unchanged ...
)
```

(If the shared library expects a specific structure, keep the stage above the `deployKamalApp` call in a `pipeline`/`script` block compatible with it — inspect `kd-wt-jenkins-chamadi/jenkins-pipelines/vars/deployKamalApp.groovy` expectations before pushing; here, just commit the file.)

- [ ] **Step 4: Docs**

`CLAUDE.md` — add to Essential Commands:

```
### Monorepo & Contract
npm test                 # vitest across workspaces (unit + fixtures conformance)
npm run test:integration # real-engine conformance (needs docker compose up)
npm run test:smoke       # Playwright smoke (needs seeded infra)
npm run audit:api        # @softx/contract public-API snapshot check
```

and one architecture paragraph pointing at the spec file.

- [ ] **Step 5: Final verification — everything green**

```bash
npm run build && npm test && npm run audit:api && git diff --exit-code -- packages/contract/etc && npm run test:smoke
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "ci: contract API snapshot gate, Playwright smoke, Jenkins checks stage"
```

---

## Definition of Done (Phases 0–1)

- [ ] Monorepo builds and deploys (Docker image builds from root; `apps/factorybay` is the app)
- [ ] `@softx/contract` 1.0.0 with `v1.CatalogService`, DTOs, `Result`; API snapshot committed and gated
- [ ] `@softx/engine` implements `v1.CatalogService`; conformance suite passes against fixtures **and** real engine (Neo4j)
- [ ] Factory Bay storefront reads catalog through the engine; no `stockPrice`/`retailPrice`/`ProductWithVariants` usage left on the catalog path
- [ ] Admin write actions still work (flat re-exports; untouched behavior)
- [ ] Jenkins runs checks before deploy
