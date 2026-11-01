# Engine/Contract Separation — Phase 2 (Cart) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the cart domain (user DB cart + guest cookie cart + zustand store) behind a versioned `CartService` in `@softx/contract`, implemented by `@softx/engine`, with the Factory Bay UI switched onto it — plus the pre-Phase-2 blocker fix (product repository database routing).

**Architecture:** Same pattern as Phase 1: contract DTOs + service interface first, shared conformance suite run against both a fixtures engine and the real Neo4j engine, then thin action wrappers and a projected store. The cart keeps today's storage model (user carts in Neo4j keyed by `User`, guest carts in the `guest_cart` cookie) — the engine owns mutations, pricing, and hydration for both owner kinds; every service method returns the full cart plus (for guests) the normalized cookie lines to persist. Spec: `docs/superpowers/specs/2026-10-31-engine-contract-separation-design.md` §5/§8 Phase 2.

**Tech Stack:** TypeScript strict, zod, vitest, neo4j-driver, zustand, Playwright. No new dependencies.

## Global Constraints

- Work on branch `engine-contract-separation` (stacks on Phase 1, HEAD `196772b`). Commit per task; **never push**.
- Canonical build (plain `npm run build` fails locally): `JWT_SECRET=build-time-placeholder NEO4J_PASSWORD=dummy MINIO_ACCESS_KEY=dummy MINIO_SECRET_KEY=dummy MINIO_BUCKET_NAME=product-images MINIO_USE_SSL=false npm run build` from repo root.
- Tests now: `npm test` = 23 passed / 11 skipped; integration = `NEO4J_PASSWORD=ecommerce123 npm run test:integration` (needs `docker compose up -d neo4j`; MinIO image is broken on Docker Hub — never `docker compose up` the minio service).
- Every contract method returns `Result<T, DomainError>`; error codes only from `NOT_FOUND | VALIDATION | CONFLICT | UNAUTHORIZED | UNAVAILABLE | UNKNOWN`.
- Contract additions are **additive** (v1 minor): the api-extractor snapshot (`npm run audit:api`) must be regenerated and committed in the same task that changes exports; `git diff --exit-code -- packages/contract/etc` must be clean afterwards.
- Money everywhere in cart DTOs: `{ amountMinor: int, currency: '3-char' }`, from `v1.fromMajorAmount(majorNumber, currency)`; engine currency = `config.defaultCurrency ?? 'LKR'`.
- Deprecated fields never enter DTOs: `ProductSummaryDTO` carries no `category`/`gender`; `VariantSummaryDTO` carries no `images`/`productId` (checkout's `variant.images` fallback collapses to `product.images`).
- Server-action names + envelope keys stay exactly as today (`{success, message?}` / `{success, data}`); inner data becomes DTOs.
- Guest cookie semantics are parity: `GuestCartItem = { variantId, quantity }`, 30-day `guest_cart` cookie, add = increment-if-exists, self-heal prunes lines whose variant vanished.
- Cart owner identity: `CartOwner = { kind: 'user'; userId: string } | { kind: 'guest'; items: GuestCartLine[] }` — the engine never reads cookies; the action layer feeds guest lines in and persists `guestItems` back out.

---

### Task 1: Blocker — product.repository honors the tenant database

**Files:**
- Modify: `packages/engine/src/repositories/product.repository.ts` (every exported function), `packages/engine/src/catalog.ts` (product-repo call sites)
- Test: existing suites (no new test file — mechanical threading; verified by grep + suites)

**Interfaces:**
- Consumes: `getSession(database?: string)` from `packages/engine/src/db.ts` (already tenant-aware)
- Produces: every exported product.repository function gains an optional **last** parameter `database?: string`; `catalog.ts` passes `config.neo4j.database` at every product-repo call site

- [ ] **Step 1: Enumerate the functions**

```bash
grep -n "^export async function" packages/engine/src/repositories/product.repository.ts
```

Expected list (verify against output): `getAllProducts`, `getProductById`, `getProductsByCategory` (deprecated), `searchProducts`, `getAllBrands`, `getProductCount`, `getVariantById`, `getVariantWithProduct` (adjust to whatever the grep actually shows — thread ALL of them).

- [ ] **Step 2: Thread the parameter**

For each function: add `database?: string` as the last parameter, and change `const session = getSession()` → `const session = getSession(database)`. Example for `getProductById`:

```ts
export async function getProductById(id: string, database?: string): Promise<ProductWithVariants | null> {
  const session = getSession(database)
  // ...body unchanged
```

(For `getAllProducts(filters?, limit = 50)` → `getAllProducts(filters?, limit = 50, database?: string)`.)

- [ ] **Step 3: Pass the config database in the catalog service**

In `packages/engine/src/catalog.ts`, every call to a product-repo function gains `config.neo4j.database` as the last argument, e.g.:

```ts
const [all, total] = await Promise.all([
  productRepo.getAllProducts(filters, limit + offset, config.neo4j.database),
  productRepo.getProductCount(filters, config.neo4j.database),
])
```

Apply to: `listProducts` (2 calls), `getProduct`, `searchProducts`, `listBrands`, `listProductsByCategories` (both `getProductsByCategories`-equivalent and `getProductById` in the composition). Also update the stale header comment in `packages/engine/test/catalog.integration.test.ts` that documents the product-repo database blindness — replace with "product.repository threads the tenant database since Phase 2 Task 1".

- [ ] **Step 4: Verify no bare getSession remains in product.repository**

```bash
grep -n "getSession()" packages/engine/src/repositories/product.repository.ts
```
Expected: empty. Then: `npm test` (23/11), `npx tsc --noEmit -p packages/engine/tsconfig.json`, canonical build, `NEO4J_PASSWORD=ecommerce123 npm run test:integration` (11/11).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(engine): product.repository threads the tenant database (pre-Phase-2 blocker)"
```

---

### Task 2: Contract — cart DTOs, CartOwner, CartService v1

**Files:**
- Create: `packages/contract/src/v1/cart/cart.dto.ts`, `packages/contract/src/v1/cart/cart.service.ts`
- Modify: `packages/contract/src/v1/index.ts` (add `export * from './cart/cart.dto'` + `export * from './cart/cart.service'`)
- Test: `packages/contract/src/v1/cart/cart.dto.test.ts`

**Interfaces:**
- Produces (under `v1`):
  - `GuestCartLine = { variantId: string; quantity: number (positive int) }`
  - `CartOwner = { kind: 'user'; userId: string } | { kind: 'guest'; items: GuestCartLine[] }`
  - `ProductSummaryDTO = { id, name, brand, sku, images: string[], price: { stock: Money, retail: Money } }`
  - `VariantSummaryDTO = { id, size: SizeOption, color: string, stockQuantity: number }`
  - `CartItemDTO = { variantId, quantity, product: ProductSummaryDTO, variant: VariantSummaryDTO }`
  - `CartDTO = { items: CartItemDTO[]; itemCount: number; total: Money }` (itemCount = Σ quantity; total = Σ stock × qty)
  - `CartMutation = { cart: CartDTO; guestItems?: GuestCartLine[] }` (guestItems present iff owner.kind === 'guest' — always normalized, so the caller can blindly persist)
  - `CartService` interface (below)

- [ ] **Step 1: Write failing schema tests**

`packages/contract/src/v1/cart/cart.dto.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CartDTOSchema, GuestCartLineSchema, CartOwnerSchema } from './cart.dto'
import { money } from '../core/money'

const validCart = {
  items: [
    {
      variantId: 'v1',
      quantity: 2,
      product: {
        id: 'p1', name: 'Tee', brand: 'Acme', sku: 'S1',
        images: ['http://x/1.webp'],
        price: { stock: money(249900, 'LKR'), retail: money(299900, 'LKR') },
      },
      variant: { id: 'v1', size: 'M', color: 'Black', stockQuantity: 5 },
    },
  ],
  itemCount: 2,
  total: money(499800, 'LKR'),
}

describe('cart DTOs', () => {
  it('accepts a valid CartDTO', () => {
    expect(CartDTOSchema.safeParse(validCart).success).toBe(true)
  })

  it('rejects zero/negative guest line quantity', () => {
    expect(GuestCartLineSchema.safeParse({ variantId: 'v1', quantity: 0 }).success).toBe(false)
  })

  it('parses both CartOwner kinds', () => {
    expect(CartOwnerSchema.safeParse({ kind: 'user', userId: 'u1' }).success).toBe(true)
    expect(CartOwnerSchema.safeParse({ kind: 'guest', items: [{ variantId: 'v1', quantity: 1 }] }).success).toBe(true)
    expect(CartOwnerSchema.safeParse({ kind: 'guest' }).success).toBe(false)
  })

  it('strips deprecated fields on parse (category never survives into a CartDTO)', () => {
    const bad = JSON.parse(JSON.stringify(validCart))
    bad.items[0].product.category = 'SHIRT'
    const parsed = CartDTOSchema.parse(bad)
    expect((parsed.items[0].product as Record<string, unknown>).category).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run, expect failure** — `npm test` → FAIL (module not found).

- [ ] **Step 3: Implement**

`packages/contract/src/v1/cart/cart.dto.ts`:

```ts
import { z } from 'zod'
import { MoneySchema } from '../core/money'
import { SizeOptionSchema } from '../catalog/product.dto'

export const GuestCartLineSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int().positive(),
})
export type GuestCartLine = z.infer<typeof GuestCartLineSchema>

export const CartOwnerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('user'), userId: z.string() }),
  z.object({ kind: z.literal('guest'), items: z.array(GuestCartLineSchema) }),
])
export type CartOwner = z.infer<typeof CartOwnerSchema>

export const ProductSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string(),
  sku: z.string(),
  images: z.array(z.string()),
  price: z.object({ stock: MoneySchema, retail: MoneySchema }),
})
export type ProductSummaryDTO = z.infer<typeof ProductSummarySchema>

export const VariantSummarySchema = z.object({
  id: z.string(),
  size: SizeOptionSchema,
  color: z.string(),
  stockQuantity: z.number().int(),
})
export type VariantSummaryDTO = z.infer<typeof VariantSummarySchema>

export const CartItemSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int().positive(),
  product: ProductSummarySchema,
  variant: VariantSummarySchema,
})
export type CartItemDTO = z.infer<typeof CartItemSchema>

export const CartDTOSchema = z.object({
  items: z.array(CartItemSchema),
  itemCount: z.number().int(),
  total: MoneySchema,
})
export type CartDTO = z.infer<typeof CartDTOSchema>

export const CartMutationSchema = z.object({
  cart: CartDTOSchema,
  guestItems: z.array(GuestCartLineSchema).optional(),
})
export type CartMutation = z.infer<typeof CartMutationSchema>
```

`packages/contract/src/v1/cart/cart.service.ts`:

```ts
import type { Result } from '../core/result'
import type { CartOwner, CartMutation, CartDTO } from './cart.dto'

export interface CartService {
  /** Full cart for the owner. For guests: heals the line list (drops vanished variants) — persist guestItems. */
  getCart(owner: CartOwner): Promise<Result<CartMutation>>
  /** Add quantity of a variant (increments when the line exists). Unknown variant → NOT_FOUND. */
  addItem(owner: CartOwner, variantId: string, quantity?: number): Promise<Result<CartMutation>>
  /** Set a line's quantity (must be ≥ 1; removing is removeItem). Unknown variant → NOT_FOUND. */
  updateItem(owner: CartOwner, variantId: string, quantity: number): Promise<Result<CartMutation>>
  removeItem(owner: CartOwner, variantId: string): Promise<Result<CartMutation>>
  clearCart(owner: CartOwner): Promise<Result<CartMutation>>
}
```

Append to `packages/contract/src/v1/index.ts`:

```ts
export * from './cart/cart.dto'
export * from './cart/cart.service'
```

- [ ] **Step 4: Tests green + snapshot regenerated (additive)**

```bash
npm test                                   # 23 + 4 new = 27 passed / 11 skipped
npm run audit:api                          # regenerates packages/contract/etc/contract.api.md
git diff --stat -- packages/contract/etc   # shows ADDITIONS only; any removal = stop and investigate
```

- [ ] **Step 5: Commit**

```bash
git add packages/contract
git commit -m "feat(contract): v1 cart DTOs, CartOwner, CartService interface"
```

---

### Task 3: Cart fixture world + conformance suite

**Files:**
- Create: `packages/contract/src/testing/cart-world.ts`, `packages/contract/src/testing/cart-conformance.ts`
- Modify: `packages/contract/src/testing/index.ts` (export both)

**Interfaces:**
- Consumes: `worldProducts` from `catalog-world.ts` (variants `conformance-v1` @2499.00 LKR ×qty and `conformance-v3` @4999.00)
- Produces:
  - `cartWorld = { user: { id: 'conformance-cart-user' }, seedCypher, teardownCypher }` — seeds a `:User` + one `:CartItem {id:'conformance-cart-item', userId:'conformance-cart-user', variantId:'conformance-v1', quantity:2, addedAt}` wired `-[:HAS_CART_ITEM]->` and `-[:CART_ITEM_FOR]->(v:ProductVariant {id:'conformance-v1'})`; teardown deletes by id prefix `conformance-cart`
  - `runCartConformance(suiteName: string, makeService: () => v1.CatalogService & v1.CartService)` — the cart suite needs catalog seeding to exist (variants come from the catalog world); the runner is responsible for seeding BOTH worlds

- [ ] **Step 1: cart-world.ts**

```ts
import type { v1 } from '../v1'

export const cartWorld = {
  user: { id: 'conformance-cart-user', email: 'conformance-cart@example.com' },
  /** Must run AFTER catalogWorld.seedCypher (references conformance-v1). */
  seedCypher: `
    CREATE (u:User {id: 'conformance-cart-user', email: 'conformance-cart@example.com',
      passwordHash: 'x', role: 'CUSTOMER', firstName: 'Conformance', lastName: 'Cart',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'})
    MATCH (v:ProductVariant {id: 'conformance-v1'})
    CREATE (c:CartItem {id: 'conformance-cart-item', userId: 'conformance-cart-user',
      variantId: 'conformance-v1', quantity: 2, addedAt: '2026-01-02T00:00:00.000Z'})
    CREATE (u)-[:HAS_CART_ITEM]->(c)
    CREATE (c)-[:CART_ITEM_FOR]->(v)
  `,
  teardownCypher: `MATCH (n) WHERE n.id STARTS WITH 'conformance-cart' DETACH DELETE n`,
} 
```

(Verify the `:User` label and property set against `user.repository.ts`'s Cypher before running — the seeded user is only a mutation anchor, never returned, so extra/missing display fields don't matter, but the label must be `User`.)

- [ ] **Step 2: cart-conformance.ts**

```ts
import { describe, it, expect } from 'vitest'
import { v1 } from '../v1'

export function runCartConformance(
  suiteName: string,
  makeService: () => v1.CatalogService & v1.CartService,
) {
  describe(`${suiteName}: CartService v1 conformance`, () => {
    const guest = (items: v1.GuestCartLine[] = []): v1.CartOwner => ({ kind: 'guest', items })
    const user: v1.CartOwner = { kind: 'user', userId: 'conformance-cart-user' }

    it('empty guest cart → empty CartDTO with zero total', async () => {
      const r = await makeService().getCart(guest())
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.data.cart.items).toEqual([])
      expect(r.data.cart.itemCount).toBe(0)
      expect(r.data.cart.total).toEqual({ amountMinor: 0, currency: 'LKR' })
      expect(r.data.guestItems).toEqual([])
    })

    it('guest addItem adds and increments; total is stock × qty in minor units', async () => {
      const s = makeService()
      const a = await s.addItem(guest(), 'conformance-v1', 2)
      expect(a.ok).toBe(true)
      if (!a.ok) return
      expect(a.data.cart.itemCount).toBe(2)
      expect(a.data.cart.total).toEqual({ amountMinor: 499800, currency: 'LKR' }) // 2 × 2499.00
      expect(a.data.guestItems).toEqual([{ variantId: 'conformance-v1', quantity: 2 }])

      const b = await s.addItem(guest(a.data.guestItems!), 'conformance-v1', 1)
      expect(b.ok && b.data.cart.itemCount).toBe(3)
      expect(b.ok && b.data.guestItems).toEqual([{ variantId: 'conformance-v1', quantity: 3 }])
    })

    it('guest updateItem / removeItem / clearCart', async () => {
      const s = makeService()
      const start = guest([{ variantId: 'conformance-v1', quantity: 3 }])
      const u = await s.updateItem(start, 'conformance-v1', 1)
      expect(u.ok && u.data.cart.itemCount).toBe(1)
      const rm = await s.removeItem(u.ok ? guest(u.data.guestItems!) : start, 'conformance-v1')
      expect(rm.ok && rm.data.cart.items).toEqual([])
      const cl = await s.clearCart(guest([{ variantId: 'conformance-v3', quantity: 1 }]))
      expect(cl.ok && cl.data.guestItems).toEqual([])
    })

    it('guest addItem unknown variant → NOT_FOUND; quantity 0 → VALIDATION', async () => {
      const s = makeService()
      const nf = await s.addItem(guest(), 'no-such-variant', 1)
      expect(nf.ok).toBe(false)
      if (!nf.ok) expect(nf.error.code).toBe('NOT_FOUND')
      const v = await s.addItem(guest(), 'conformance-v1', 0)
      expect(v.ok).toBe(false)
      if (!v.ok) expect(v.error.code).toBe('VALIDATION')
    })

    it('guest getCart heals lines whose variant vanished', async () => {
      const s = makeService()
      const r = await s.getCart(guest([
        { variantId: 'conformance-v1', quantity: 1 },
        { variantId: 'vanished-variant', quantity: 4 },
      ]))
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.data.cart.itemCount).toBe(1)
      expect(r.data.guestItems).toEqual([{ variantId: 'conformance-v1', quantity: 1 }])
    })

    it('user cart reads the seeded line; mutations persist per-call', async () => {
      const s = makeService()
      const g = await s.getCart(user)
      expect(g.ok && g.data.cart.itemCount).toBe(2)
      const a = await s.addItem(user, 'conformance-v3', 1)
      expect(a.ok && a.data.cart.itemCount).toBe(3) // seeded 2 + new 1
      expect(a.data.guestItems).toBeUndefined()
      const u = await s.updateItem(user, 'conformance-v3', 2)
      expect(u.ok && u.data.cart.itemCount).toBe(4) // 2 + 2
      const rm = await s.removeItem(user, 'conformance-v3')
      expect(rm.ok && rm.data.cart.itemCount).toBe(2)
      // restore the seeded state for repeatability
      await s.clearCart(user)
      await s.addItem(user, 'conformance-v1', 2)
    })
  })
}
```

Append to `packages/contract/src/testing/index.ts`:

```ts
export * from './cart-world'
export * from './cart-conformance'
```

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc -p packages/contract/tsconfig.json --noEmit
git add packages/contract
git commit -m "feat(contract): cart fixture world + shared cart conformance suite"
```

(Suite is unwired — Tasks 5/6 wire it, same as Phase 1.)

---

### Task 4: Engine — cart mappers + CartService implementation

**Files:**
- Create: `packages/engine/src/cart.ts`, `packages/engine/src/mappers/cart.mapper.ts`
- Modify: `packages/engine/src/engine.ts` (`TenantEngine` gains `cart: v1.CartService`), `packages/engine/src/repositories/cart.repository.ts` (database threading)
- Test: `packages/engine/src/mappers/cart.mapper.test.ts`

**Interfaces:**
- Consumes: `cart.repository` (`addToCart(userId, variantId, quantity)`, `removeFromCart`, `updateCartItemQuantity`, `getCartItems → CartItemWithDetails[]`, `getCartCount`, `clearCart` — all gain last param `database?: string` exactly like Task 1); `product.repository.getVariantWithProduct(variantId, database?)` for guest hydration
- Produces: `createCartService(config: EngineConfig, tenant: TenantRef): v1.CartService`; `TenantEngine.cart`; mappers `toCartItemDTO(item: CartItemWithDetails, currency): v1.CartItemDTO` and `cartTotal(items, currency): v1.Money`

- [ ] **Step 1: Thread database through cart.repository** — same mechanical edit as Task 1 for its 6 exported functions (`getSession(database)`).

- [ ] **Step 2: Failing mapper tests** — `packages/engine/src/mappers/cart.mapper.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toCartItemDTO, cartTotal } from './cart.mapper'

const repoItem = {
  id: 'c1', userId: 'u1', variantId: 'v1', quantity: 2, addedAt: '2026-01-01T00:00:00.000Z',
  product: { id: 'p1', name: 'Tee', brand: 'Acme', category: 'SHIRT', gender: 'UNISEX',
             stockPrice: 2499, retailPrice: 2999, sku: 'S1', images: ['http://x/1.webp'] },
  variant: { id: 'v1', productId: 'p1', size: 'M', color: 'Black', stockQuantity: 5, images: ['old'] },
}

describe('cart mappers', () => {
  it('maps to CartItemDTO with Money prices and no deprecated fields', () => {
    const dto = toCartItemDTO(repoItem as never, 'LKR')
    expect(dto.product.price.stock).toEqual({ amountMinor: 249900, currency: 'LKR' })
    expect(dto.product).not.toHaveProperty('category')
    expect(dto.variant).not.toHaveProperty('images')
    expect(dto.variant).not.toHaveProperty('productId')
  })

  it('cartTotal sums stock × qty in minor units', () => {
    const items = [toCartItemDTO(repoItem as never, 'LKR')]
    expect(cartTotal(items, 'LKR')).toEqual({ amountMinor: 499800, currency: 'LKR' })
  })
})
```

Run: `npm test` → FAIL (module not found).

- [ ] **Step 3: Implement mappers**

`packages/engine/src/mappers/cart.mapper.ts`:

```ts
import { fromMajorAmount, money, type v1 } from '@softx/contract'
import type { CartItemWithDetails } from '../repositories/cart.repository'

export function toCartItemDTO(item: CartItemWithDetails, currency: string): v1.CartItemDTO {
  return {
    variantId: item.variantId,
    quantity: item.quantity,
    product: {
      id: item.product.id,
      name: item.product.name,
      brand: item.product.brand,
      sku: item.product.sku,
      images: item.product.images ?? [],
      price: {
        stock: fromMajorAmount(item.product.stockPrice, currency),
        retail: fromMajorAmount(item.product.retailPrice, currency),
      },
    },
    variant: {
      id: item.variant.id,
      size: item.variant.size,
      color: item.variant.color,
      stockQuantity: item.variant.stockQuantity,
    },
  }
}

export function cartTotal(items: v1.CartItemDTO[], currency: string): v1.Money {
  return money(
    items.reduce((sum, i) => sum + i.product.price.stock.amountMinor * i.quantity, 0),
    currency
  )
}
```

- [ ] **Step 4: Implement the service** — `packages/engine/src/cart.ts`:

```ts
import { ok, err, fromMajorAmount, type v1 } from '@softx/contract'
import type { EngineConfig, TenantRef } from './engine'
import { toCartItemDTO, cartTotal } from './mappers/cart.mapper'
import * as cartRepo from './repositories/cart.repository'
import * as productRepo from './repositories/product.repository'

/** Pure guest-line reducer — the cookie model, engine-side. */
function guestAdd(items: v1.GuestCartLine[], variantId: string, quantity: number): v1.GuestCartLine[] {
  const existing = items.find((l) => l.variantId === variantId)
  if (!existing) return [...items, { variantId, quantity }]
  return items.map((l) => (l.variantId === variantId ? { ...l, quantity: l.quantity + quantity } : l))
}

export function createCartService(config: EngineConfig, _tenant: TenantRef): v1.CartService {
  const currency = config.defaultCurrency ?? 'LKR'
  const db = config.neo4j.database

  async function hydrateGuest(items: v1.GuestCartLine[]): Promise<v1.CartItemDTO[]> {
    const out: v1.CartItemDTO[] = []
    for (const line of items) {
      const data = await productRepo.getVariantWithProduct(line.variantId, db)
      if (!data) continue // self-heal: vanished variant drops out
      out.push({
        variantId: line.variantId,
        quantity: line.quantity,
        product: {
          id: data.product.id, name: data.product.name, brand: data.product.brand,
          sku: data.product.sku, images: data.product.images ?? [],
          price: {
            stock: fromMajorAmount(data.product.stockPrice, currency),
            retail: fromMajorAmount(data.product.retailPrice, currency),
          },
        },
        variant: {
          id: data.variant.id, size: data.variant.size, color: data.variant.color,
          stockQuantity: data.variant.stockQuantity,
        },
      })
    }
    return out
  }

  function cartFrom(items: v1.CartItemDTO[]): v1.CartDTO {
    return { items, itemCount: items.reduce((n, i) => n + i.quantity, 0), total: cartTotal(items, currency) }
  }

  async function guestResult(items: v1.GuestCartLine[]): Promise<v1.Result<v1.CartMutation>> {
    return ok({ cart: cartFrom(await hydrateGuest(items)), guestItems: items })
  }

  return {
    async getCart(owner) {
      try {
        if (owner.kind === 'guest') return await guestResult(owner.items)
        const rows = await cartRepo.getCartItems(owner.userId, db)
        return ok({ cart: cartFrom(rows.map((r) => toCartItemDTO(r, currency))) })
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to get cart', { cause: String(e) })
      }
    },

    async addItem(owner, variantId, quantity = 1) {
      try {
        if (quantity < 1) return err('VALIDATION', 'Quantity must be at least 1')
        const exists = await productRepo.getVariantWithProduct(variantId, db)
        if (!exists) return err('NOT_FOUND', `Variant ${variantId} not found`)
        if (owner.kind === 'guest') return await guestResult(guestAdd(owner.items, variantId, quantity))
        await cartRepo.addToCart(owner.userId, variantId, quantity, db)
        return await this.getCart(owner)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to add item', { cause: String(e) })
      }
    },

    async updateItem(owner, variantId, quantity) {
      try {
        if (quantity < 1) return err('VALIDATION', 'Quantity must be at least 1')
        if (owner.kind === 'guest') {
          if (!owner.items.some((l) => l.variantId === variantId)) {
            return err('NOT_FOUND', `Cart line for ${variantId} not found`)
          }
          return await guestResult(
            owner.items.map((l) => (l.variantId === variantId ? { ...l, quantity } : l))
          )
        }
        await cartRepo.updateCartItemQuantity(owner.userId, variantId, quantity, db)
        return await this.getCart(owner)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to update item', { cause: String(e) })
      }
    },

    async removeItem(owner, variantId) {
      try {
        if (owner.kind === 'guest') {
          return await guestResult(owner.items.filter((l) => l.variantId !== variantId))
        }
        await cartRepo.removeFromCart(owner.userId, variantId, db)
        return await this.getCart(owner)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to remove item', { cause: String(e) })
      }
    },

    async clearCart(owner) {
      try {
        if (owner.kind === 'guest') return await guestResult([])
        await cartRepo.clearCart(owner.userId, db)
        return await this.getCart(owner)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to clear cart', { cause: String(e) })
      }
    },
  }
}
```

**Verification duty before finalizing:** open `product.repository.ts` and confirm `getVariantWithProduct`'s real return shape (`{ product, variant }` with which fields?) — adapt the hydration field reads to reality and record the actual shape in your report. Also confirm `getCartItems` ordering (`addedAt DESC`) survives mapping. In `engine.ts`, wire: `get cart(): v1.CartService { return createCartService(config, tenant) }` next to the existing catalog getter, with a top-level import (no lazy require).

- [ ] **Step 5: Tests + build + commit**

```bash
npm test        # 27 + 2 mapper = 29 passed / 11 skipped
npx tsc --noEmit -p packages/engine/tsconfig.json
JWT_SECRET=build-time-placeholder NEO4J_PASSWORD=dummy MINIO_ACCESS_KEY=dummy MINIO_SECRET_KEY=dummy MINIO_BUCKET_NAME=product-images MINIO_USE_SSL=false npm run build
git add packages/engine
git commit -m "feat(engine): cart mappers + CartService v1 (user DB cart + guest reducer)"
```

---

### Task 5: engine-fixtures — fake CartService

**Files:**
- Create: `packages/engine-fixtures/src/fake-cart.ts`
- Create: `packages/engine-fixtures/src/fake-cart.conformance.test.ts`
- Modify: `packages/engine-fixtures/src/fake-engine.ts` (expose `cart`)

**Interfaces:**
- Produces: `createFakeCartService(): v1.CartService` (in-memory user carts keyed by userId, starting from the seeded `cartWorld` state; guest = pure reducer over catalog-world products); fake engine's `for()` returns `{ catalog, cart }`

- [ ] **Step 1: Implement** — `packages/engine-fixtures/src/fake-cart.ts`:

```ts
import { ok, err, money, testing, type v1 } from '@softx/contract'

/** In-memory user carts, pre-seeded to match cartWorld. */
export function createFakeCartService(): v1.CartService {
  const userCarts = new Map<string, v1.GuestCartLine[]>([
    ['conformance-cart-user', [{ variantId: 'conformance-v1', quantity: 2 }]],
  ])

  function lineToItem(line: v1.GuestCartLine): v1.CartItemDTO | null {
    for (const p of testing.worldProducts) {
      const variant = p.variants.find((v) => v.id === line.variantId)
      if (variant) {
        return {
          variantId: line.variantId,
          quantity: line.quantity,
          product: {
            id: p.id, name: p.name, brand: p.brand, sku: p.sku, images: p.images,
            price: { stock: p.price.stock, retail: p.price.retail },
          },
          variant: { id: variant.id, size: variant.size, color: variant.color, stockQuantity: variant.stockQuantity },
        }
      }
    }
    return null // vanished variant → healed away
  }

  function cartFrom(items: v1.CartItemDTO[]): v1.CartDTO {
    return {
      items,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      total: money(items.reduce((n, i) => n + i.product.price.stock.amountMinor * i.quantity, 0), 'LKR'),
    }
  }

  async function hydrate(lines: v1.GuestCartLine[]): Promise<v1.CartItemDTO[]> {
    return lines.map(lineToItem).filter((i): i is v1.CartItemDTO => i !== null)
  }

  async function guestResult(lines: v1.GuestCartLine[]): Promise<v1.Result<v1.CartMutation>> {
    return ok({ cart: cartFrom(await hydrate(lines)), guestItems: lines })
  }

  return {
    async getCart(owner) {
      if (owner.kind === 'guest') return guestResult(owner.items)
      return ok({ cart: cartFrom(await hydrate(userCarts.get(owner.userId) ?? [])) })
    },
    async addItem(owner, variantId, quantity = 1) {
      if (quantity < 1) return err('VALIDATION', 'Quantity must be at least 1')
      const known = testing.worldProducts.some((p) => p.variants.some((v) => v.id === variantId))
      if (!known) return err('NOT_FOUND', `Variant ${variantId} not found`)
      if (owner.kind === 'guest') {
        const existing = owner.items.find((l) => l.variantId === variantId)
        const items = existing
          ? owner.items.map((l) => (l.variantId === variantId ? { ...l, quantity: l.quantity + quantity } : l))
          : [...owner.items, { variantId, quantity }]
        return guestResult(items)
      }
      const lines = userCarts.get(owner.userId) ?? []
      const existing = lines.find((l) => l.variantId === variantId)
      userCarts.set(owner.userId, existing
        ? lines.map((l) => (l.variantId === variantId ? { ...l, quantity: l.quantity + quantity } : l))
        : [...lines, { variantId, quantity }])
      return this.getCart(owner)
    },
    async updateItem(owner, variantId, quantity) {
      if (quantity < 1) return err('VALIDATION', 'Quantity must be at least 1')
      if (owner.kind === 'guest') {
        if (!owner.items.some((l) => l.variantId === variantId)) {
          return err('NOT_FOUND', `Cart line for ${variantId} not found`)
        }
        return guestResult(owner.items.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)))
      }
      const lines = userCarts.get(owner.userId) ?? []
      if (!lines.some((l) => l.variantId === variantId)) {
        return err('NOT_FOUND', `Cart line for ${variantId} not found`)
      }
      userCarts.set(owner.userId, lines.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)))
      return this.getCart(owner)
    },
    async removeItem(owner, variantId) {
      if (owner.kind === 'guest') return guestResult(owner.items.filter((l) => l.variantId !== variantId))
      userCarts.set(owner.userId, (userCarts.get(owner.userId) ?? []).filter((l) => l.variantId !== variantId))
      return this.getCart(owner)
    },
    async clearCart(owner) {
      if (owner.kind === 'guest') return guestResult([])
      userCarts.set(owner.userId, [])
      return this.getCart(owner)
    },
  }
}
```

And expose it on the fake engine — `packages/engine-fixtures/src/fake-engine.ts` becomes:

```ts
import type { v1 } from '@softx/contract'
import { createFakeCatalogService } from './fake-catalog'
import { createFakeCartService } from './fake-cart'

export interface FakeEngine {
  for(_tenant: { clientId: string }): { catalog: v1.CatalogService; cart: v1.CartService }
}

export function createFakeEngine(): FakeEngine {
  return {
    for: () => ({
      catalog: createFakeCatalogService(),
      cart: createFakeCartService(),
    }),
  }
}
```

- [ ] **Step 2: Wire the suite**

`packages/engine-fixtures/src/fake-cart.conformance.test.ts`:

```ts
import { testing } from '@softx/contract/testing'
import { createFakeCatalogService } from './fake-catalog'
import { createFakeCartService } from './fake-cart'

testing.runCartConformance('engine-fixtures', () => ({
  ...createFakeCatalogService(),
  ...createFakeCartService(),
}))
```

Run: `npm test` → 29 + 6 cart conformance = **35 passed / 11 skipped**.

- [ ] **Step 3: Commit** — `git commit -m "feat(engine-fixtures): fake cart service passing cart conformance suite"`

---

### Task 6: Real-engine cart conformance (integration)

**Files:**
- Create: `packages/engine/test/cart.integration.test.ts`

**Interfaces:**
- Consumes: `catalogWorld` + `cartWorld` seeds (cart seed AFTER catalog seed), `runCartConformance`
- Produces: cart conformance runs under the existing `RUN_INTEGRATION=1` gate; after this task `npm run test:integration` = 11 catalog + 6 cart = **17 passing**

- [ ] **Step 1: Test file** — copy the structure of `catalog.integration.test.ts`: same skip gate, driver setup, `verifyConnectivity`; `beforeAll` seeds catalogWorld.seedCypher THEN cartWorld.seedCypher (and runs the existing pre-seed teardown of both worlds first — mirror how catalog.integration handles idempotency); `afterAll` tears down cartWorld THEN catalogWorld, closes seed driver and engine. The runner:

```ts
testing.runCartConformance('real-engine', () => {
  const tenant = engine.for({ clientId: 'conformance' })
  return { ...tenant.catalog, ...tenant.cart }
})
```

- [ ] **Step 2: Run + verify counts**

```bash
docker compose up -d neo4j   # wait for bolt readiness
NEO4J_PASSWORD=ecommerce123 npm run test:integration   # 17 passed
npm test                                               # 35 passed / 17 skipped
```

- [ ] **Step 3: Commit** — `git commit -m "test(engine): real-engine cart conformance run"`

---

### Task 7: App switch — cart actions, store projection, consumers

**Files:**
- Modify: `apps/factorybay/src/app/actions/cart.ts` (full rewrite as wrappers), `apps/factorybay/src/stores/cartStore.ts` (projection), `apps/factorybay/src/lib/price.ts` (`cartRetailTotal` → CartItemDTO), `apps/factorybay/src/components/cart/CartItem.tsx`, `apps/factorybay/src/app/[locale]/cart/CartPageClient.tsx`, `apps/factorybay/src/app/[locale]/checkout/CheckoutPageClient.tsx`, `apps/factorybay/src/app/[locale]/checkout/page.tsx` (only if it passes cart shapes), `apps/factorybay/src/app/[locale]/cart/page.tsx` (only if typed)
- Test: Task 8's smoke covers the flow; `npm run build` gates types

**Interfaces:**
- Consumes: `getEngine().for(...).cart` via a `getCartService()` helper added to `apps/factorybay/src/lib/engine.ts` (next to `getCatalog()`); `GuestCartLine` from `@softx/contract`
- Produces: same 6 action names + envelopes; `getCartItemsAction` data becomes `{ items: v1.CartItemDTO[]; total: v1.Money; itemCount: number }`; store state `{ items: v1.CartItemDTO[]; itemCount: number; total: v1.Money }`

- [ ] **Step 1: Action wrappers** — first add the service accessor to `apps/factorybay/src/lib/engine.ts` (next to `getCatalog()`):

```ts
export function getCartService() {
  return getEngine().for({ clientId: process.env.CLIENT_ID || 'factorybay' }).cart
}
```

Then `apps/factorybay/src/app/actions/cart.ts` full replacement:

```ts
'use server'

import { getCurrentUserId } from '@/lib/auth'
import { getCartService } from '@/lib/engine'
import { getGuestCart, saveGuestCart, clearGuestCart } from '@/lib/guest-cart'
import type { ActionResponse } from '@softx/engine'
import type { v1 } from '@softx/contract'

async function currentOwner(): Promise<v1.CartOwner> {
  const userId = await getCurrentUserId()
  if (userId) return { kind: 'user', userId }
  // Legacy cookies may hold quantity <= 0 lines — the contract requires positive ints.
  const items = (await getGuestCart()).filter((l) => l.quantity >= 1)
  return { kind: 'guest', items }
}

/** Persist normalized guest lines back to the cookie. Safe only in action context — same rule as today. */
async function persistGuest(m: v1.CartMutation): Promise<void> {
  if (m.guestItems) {
    try {
      await saveGuestCart(m.guestItems)
    } catch {
      // Server Component render context — ignore; the next client-triggered call heals.
    }
  }
}

/** The projection payload every mutation returns so the store never refetches. */
type CartProjection = { items: v1.CartItemDTO[]; total: v1.Money; itemCount: number }

function projectionOf(m: v1.CartMutation): CartProjection {
  return { items: m.cart.items, total: m.cart.total, itemCount: m.cart.itemCount }
}

export async function addToCartAction(variantId: string, quantity = 1): Promise<ActionResponse<CartProjection>> {
  const r = await getCartService().addItem(await currentOwner(), variantId, quantity)
  if (!r.ok) return { success: false, message: r.error.message }
  await persistGuest(r.data)
  return { success: true, message: 'Item added to cart', data: projectionOf(r.data) }
}

export async function removeFromCartAction(variantId: string): Promise<ActionResponse<CartProjection>> {
  const r = await getCartService().removeItem(await currentOwner(), variantId)
  if (!r.ok) return { success: false, message: r.error.message }
  await persistGuest(r.data)
  return { success: true, message: 'Item removed from cart', data: projectionOf(r.data) }
}

export async function updateCartItemAction(variantId: string, quantity: number): Promise<ActionResponse<CartProjection>> {
  if (quantity < 1) return { success: false, message: 'Quantity must be at least 1' }
  const r = await getCartService().updateItem(await currentOwner(), variantId, quantity)
  if (!r.ok) return { success: false, message: r.error.message }
  await persistGuest(r.data)
  return { success: true, message: 'Cart updated', data: projectionOf(r.data) }
}

export async function getCartItemsAction(): Promise<
  ActionResponse<{ items: v1.CartItemDTO[]; total: v1.Money; itemCount: number }>
> {
  const r = await getCartService().getCart(await currentOwner())
  if (!r.ok) return { success: false, message: r.error.message }
  await persistGuest(r.data) // heals the cookie during reads too, when allowed
  return { success: true, data: { items: r.data.cart.items, total: r.data.cart.total, itemCount: r.data.cart.itemCount } }
}

export async function getCartCountAction(): Promise<ActionResponse<{ count: number }>> {
  const r = await getCartService().getCart(await currentOwner())
  if (!r.ok) return { success: false, message: r.error.message }
  await persistGuest(r.data)
  return { success: true, data: { count: r.data.cart.itemCount } }
}

export async function clearCartAction(): Promise<ActionResponse> {
  const r = await getCartService().clearCart(await currentOwner())
  if (!r.ok) return { success: false, message: r.error.message }
  if ((await getCurrentUserId()) == null) await clearGuestCart().catch(() => {})
  return { success: true, message: 'Cart cleared' }
}
```

**Verification duty:** `apps/factorybay/src/lib/guest-cart.ts` — `getGuestCart()` returns `GuestCartItem[]` ({variantId, quantity}) which is structurally `v1.GuestCartLine` after zod (quantity positive — a legacy cookie could hold 0/negative; filter `q >= 1` in `currentOwner()` before passing to the service). Confirm `getGuestCart` is async and cookie-read-only (safe in render) — it is, per Phase 1 reading.

- [ ] **Step 2: Store projection** — `cartStore.ts`: state becomes `{ items: v1.CartItemDTO[]; itemCount: number; total: v1.Money }`; `loadCart` sets from `getCartItemsAction`; **each mutation consumes the `data` projection the action now returns** (see Step 1 — `addToCartAction`/`updateCartItemAction`/`removeFromCartAction` all return `data: { items, total, itemCount }`): on success `set({ items: data.items, itemCount: data.itemCount, total: data.total })` with no refetch. Optimistic pre-update may remain but MUST be reconciled from `data` on success.

- [ ] **Step 3: Consumers** — exact transformations:
  - `CartItem.tsx`: `item.product.stockPrice * localQuantity` → `amount(item.product.price.stock) * localQuantity`; `Rs {item.product.stockPrice.toFixed(2)} each` → `Rs {amount(item.product.price.stock).toFixed(2)} each`; `item.variant.stockQuantity` unchanged (DTO carries it); import `{ amount }` from `@/lib/price`.
  - `CartPageClient.tsx`: total rendering — find the `Rs {total...}` site(s) and render `Rs {amount(total).toFixed(2)}`; `cartRetailTotal` usage (if any) → new signature below.
  - `CheckoutPageClient.tsx`: `item.variant.images?.[0] || item.product.images?.[0]` → `item.product.images?.[0]`; every `item.product.stockPrice`/`retailPrice`/`item.product.retailPrice` read → `amount(item.product.price.stock|retail)`; prop types referencing `CartItemWithDetails` → `v1.CartItemDTO`.
  - `price.ts`: replace `cartRetailTotal(items: CartItemWithDetails[])` with:

```ts
export function cartRetailTotal(items: v1.CartItemDTO[]): number {
  return items.reduce((sum, item) => sum + amount(item.product.price.retail) * item.quantity, 0)
}
```

- [ ] **Step 4: Verify**

```bash
npm test                                                  # 35 passed / 17 skipped
JWT_SECRET=... npm run build                             # canonical prefix, exit 0
grep -rn "stockPrice\|retailPrice" apps/factorybay/src --include="*.tsx" \
  | grep -v "admin/ProductFormDialog" | grep -v "CartItemWithDetails"   # expect empty
grep -rn "CartItemWithDetails" apps/factorybay/src        # only engine-internal/type legacy allowed in write paths; report any storefront hits
```

- [ ] **Step 5: Commit** — `git commit -m "feat(app): cart switched to CartService — projection store, Money totals, healed guest cookie"`

---

### Task 8: Smoke — add-to-cart journey + docs + final verification

**Files:**
- Create: `apps/factorybay/e2e/cart.spec.ts`
- Modify: `apps/factorybay/e2e/smoke.spec.ts` (header cross-reference only if needed), `CLAUDE.md` (Phase 2 note)

**Interfaces:**
- Produces: third golden journey (PDP → add → cart shows item + count) in `npm run test:smoke`; CLAUDE.md notes cart is engine-served

- [ ] **Step 1: Spec** — `apps/factorybay/e2e/cart.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

// Uses the SMOKE-* products seeded by scripts/seed-smoke-products.cypher (see smoke.spec.ts header).
// PDP flow: the product detail page may require size/color selection before Add-to-cart
// is enabled — inspect ProductDetailClient.tsx first and adapt the two pick steps below.

test('guest can add a product to the cart', async ({ page }) => {
  await page.goto('/en/shop')
  await page.getByRole('link', { name: /classic cotton|oversized|denim|essential/i }).first().click()
  await page.waitForURL('**/product/**')

  // Pick the first enabled size (and color, if the page shows swatches) — verify against the real PDP.
  const size = page.getByRole('button', { name: /^(XS|S|M|L|XL|XXL)$/ }).first()
  if (await size.isEnabled()) await size.click()

  await page.getByRole('button', { name: /add to cart|add to bag/i }).click()
  await expect(page.getByRole('link', { name: /cart/i }).first()).toBeVisible()

  await page.goto('/en/cart')
  await expect(page.getByText(/classic cotton|oversized|denim|essential/i).first()).toBeVisible()
  await expect(page.getByText(/Rs/i).first()).toBeVisible()
})
```

**Verification duty:** read `ProductDetailClient.tsx`'s add-to-cart flow (variant selection requirements, button label, post-add feedback) and adjust the pick/label selectors to reality; keep the final `/en/cart` assertions. If the PDP auto-selects a default variant, delete the size-pick step.

- [ ] **Step 2: Run everything**

```bash
docker compose up -d neo4j
docker compose exec -T neo4j bash -c 'cypher-shell -u neo4j -p ecommerce123' < apps/factorybay/scripts/seed-smoke-products.cypher
npm run test:smoke          # 2 old + 1 new = 3 passed
# then clean SMOKE-* products (header predicate) and:
NEO4J_PASSWORD=ecommerce123 npm run test:integration   # 17 passed
npm test                                                # 35 passed / 17 skipped
JWT_SECRET=... npm run build && npm run audit:api && git diff --exit-code -- packages/contract/etc
```

- [ ] **Step 3: CLAUDE.md** — under "Catalog Contract & Engine", add: "Cart (Phase 2): user + guest carts are served by `CartService` (`packages/engine/src/cart.ts`); the zustand store is a projection of `CartMutation.cart`; guest cookie lines are normalized by the engine and persisted by the actions."

- [ ] **Step 4: Commit** — `git commit -m "test(app): add-to-cart smoke journey + Phase 2 docs"`

---

## Definition of Done (Phase 2)

- [ ] product.repository threads `config.neo4j.database` (grep: zero bare `getSession()`); catalog + cart services route every query through the tenant database
- [ ] `@softx/contract` v1 gains cart DTOs/CartOwner/CartService — additive, snapshot regenerated and committed
- [ ] Cart conformance (6 tests) passes on fixtures AND real engine (17 integration total)
- [ ] App cart path fully on the engine: no `stockPrice`/`retailPrice`/`CartItemWithDetails` in storefront cart code; Money totals everywhere; guest cookie self-heal preserved via `guestItems` write-back
- [ ] Store is a projection (mutations return the cart; no refetch round-trip)
- [ ] Smoke covers browse → PDP → cart; build, unit, integration, audit:api all green
