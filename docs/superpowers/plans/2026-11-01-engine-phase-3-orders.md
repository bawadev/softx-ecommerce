# Engine/Contract Separation — Phase 3 (Checkout/Orders) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the order/checkout domain behind `OrderService` v1 (create-from-cart with server-side totals, customer order reads, payment-proof attach), move `order.ts`/`payment.ts`/the auth login cart-merge onto the engine, and pin the cart edge-case conformance left open by Phase 2.

**Architecture:** Same pattern as Phases 1–2: contract DTOs + service first, shared conformance on fixtures + real Neo4j, then thin action wrappers. Totals/shipping math moves INTO the engine (computed from CartService's cart — one source of Money truth); ownership enforcement becomes the service's job (UNAUTHORIZED). Admin order operations (updateOrderStatus, getAllOrders) stay on repositories until Phase 5 per the design. Spec: `docs/superpowers/specs/2026-10-31-engine-contract-separation-design.md` §8 Phase 3 ("logic wrapped as-is").

**Tech Stack:** TypeScript strict, zod, vitest, neo4j-driver, Playwright. No new dependencies.

## Global Constraints

- Work on branch `engine-contract-separation` (HEAD `7195263` + merge `69e0aab` lineage; rebase onto `origin/master` first if it has moved). Commit per task; **never push** (the controller pushes).
- Canonical build: `JWT_SECRET=build-time-placeholder NEO4J_PASSWORD=dummy MINIO_ACCESS_KEY=dummy MINIO_SECRET_KEY=dummy MINIO_BUCKET_NAME=product-images MINIO_USE_SSL=false npm run build` from repo root.
- Tests now: `npm test` = 35 passed / 17 skipped; integration = `NEO4J_PASSWORD=ecommerce123 npm run test:integration` → 17 (needs `docker compose up -d neo4j`; NEVER the minio service — image broken).
- Every contract method returns `Result<T, DomainError>`; codes only from `NOT_FOUND | VALIDATION | CONFLICT | UNAUTHORIZED | UNAVAILABLE | UNKNOWN`.
- Contract additions are **additive** (v1 minor): regenerate the api-extractor snapshot (`npm run audit:api`) in the same task that changes exports; `git diff --exit-code -- packages/contract/etc` clean after.
- Money everywhere in order DTOs (`fromMajorAmount(major, currency)`; engine currency `config.defaultCurrency ?? 'LKR'`).
- **Pricing parity, exactly as today** (`apps/factorybay/src/app/actions/order.ts:45-51`): subtotal = Σ stock price × qty; shipping = `deliveryMethod === 'SHIP' ? (subtotal >= 100 ? 0 : 9.99) : 0`; total = subtotal + shipping. 9.99 → `999` minor units.
- `priceAtPurchase` is the STOCK price at order time (major units stored in DB, Money in DTOs).
- Ownership: `getOrder`/`listOrders`/`attachPaymentProof` take `userId` and return `UNAUTHORIZED` when the order belongs to someone else (today's action-level check moves in).
- Guest users cannot order (today's behavior): `createOrder` takes `userId` and returns `UNAUTHORIZED` for a falsy id — the action layer keeps its own logged-in guard for the friendly message.
- Server-action names + envelope keys unchanged; MinIO upload stays app-side (`lib/minio`); the service only records the resulting URL.
- Admin writes (`updateOrderStatusAction`, `getAllOrders`) remain repository-based this phase.

---

### Task 1: Pin the cart edge-case conformance (Phase 2 leftovers)

**Files:**
- Modify: `packages/contract/src/testing/cart-conformance.ts` (add 3 `it` blocks inside the existing describe)

**Interfaces:**
- Consumes: existing `runCartConformance` structure, worldProducts variants
- Produces: 9 cart conformance tests (was 6) — pins semantics engine+fake already implement

- [ ] **Step 1: Add the three tests** (append before the suite's closing `})`):

```ts
    it('guest updateItem on a vanished-variant line heals it away', async () => {
      const s = makeService()
      const r = await s.updateItem(
        guest([{ variantId: 'vanished-variant', quantity: 2 }]),
        'vanished-variant',
        3,
      )
      // Either NOT_FOUND (missing-line reading) or a healed empty cart is contract-valid;
      // what is NOT valid is a mutation that keeps the dead line.
      if (r.ok) {
        expect(r.data.cart.items).toEqual([])
        expect(r.data.guestItems).toEqual([])
      } else {
        expect(r.error.code).toBe('NOT_FOUND')
      }
    })

    it('user updateItem on a missing line → NOT_FOUND', async () => {
      const s = makeService()
      const r = await s.updateItem(user, 'no-such-variant-in-cart', 2)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.code).toBe('NOT_FOUND')
    })

    it('guest updateItem round-trips the updated guestItems', async () => {
      const s = makeService()
      const u = await s.updateItem(
        guest([
          { variantId: 'conformance-v1', quantity: 2 },
          { variantId: 'conformance-v3', quantity: 1 },
        ]),
        'conformance-v1',
        5,
      )
      expect(u.ok).toBe(true)
      if (!u.ok) return
      expect(u.data.guestItems).toContainEqual({ variantId: 'conformance-v1', quantity: 5 })
      expect(u.data.guestItems).toContainEqual({ variantId: 'conformance-v3', quantity: 1 })
      expect(u.data.cart.itemCount).toBe(6)
    })
```

- [ ] **Step 2: Run BOTH runners** — `npm test` (fixtures: 35 + 3 = 38 passed / 17 skipped) and `NEO4J_PASSWORD=ecommerce123 npm run test:integration` (17 + 3 = 20 passed). If either runner fails, the runner's implementation deviates from the pinned contract — fix the implementation, never the pin.

- [ ] **Step 3: Commit**

```bash
git add packages/contract
git commit -m "test(contract): pin cart edge cases — healed updateItem, user NOT_FOUND, guestItems round-trip"
```

---

### Task 2: Contract — order DTOs + OrderService + CartService.mergeCarts

**Files:**
- Create: `packages/contract/src/v1/order/order.dto.ts`, `packages/contract/src/v1/order/order.service.ts`
- Modify: `packages/contract/src/v1/cart/cart.service.ts` (add mergeCarts), `packages/contract/src/v1/index.ts` (export order module)
- Test: `packages/contract/src/v1/order/order.dto.test.ts`

**Interfaces:**
- Produces (under `v1`):
  - `OrderStatus = 'PENDING' | 'CONFIRMED' | 'FULFILLED' | 'CANCELLED'`; `DeliveryMethod = 'SHIP' | 'COLLECT'` (zod enums)
  - `ShippingAddressSchema = { fullName, addressLine1, addressLine2?, city, state, postalCode, country, phone }` (all strings; mirrors engine type `ShippingAddress`)
  - `OrderItemDTO = { variantId: string; quantity: positive int; priceAtPurchase: Money; productName: string; productImage?: string }` — check what `OrderWithItems` items actually carry (`order.repository.ts:5-22`) and include the display fields the order pages read (verify against OrderConfirmationClient/OrdersPageClient before finalizing; include exactly those, nothing more)
  - `OrderDTO = { id, orderNumber, status: OrderStatus, totalAmount: Money, shippingAddress, deliveryMethod, paymentProof?: string, items: OrderItemDTO[], createdAt, updatedAt }`
  - `CreateOrderCommand = { shippingAddress: ShippingAddress; deliveryMethod: DeliveryMethod; email?: string }`
  - `CartService` gains: `mergeCarts(from: CartOwner, toUserId: string): Promise<Result<CartMutation>>` (moves `from` lines into the user cart — validating/healing like addItem; returns the USER cart; guest callers then clear their cookie themselves)
  - `OrderService`: `createOrder(userId: string, command: CreateOrderCommand): Promise<Result<OrderDTO>>` · `getOrder(userId: string, orderId: string): Promise<Result<OrderDTO>>` · `listOrders(userId: string): Promise<Result<OrderDTO[]>>` · `attachPaymentProof(userId: string, orderId: string, proofUrl: string): Promise<Result<OrderDTO>>`

- [ ] **Step 1: Write failing schema tests** — `packages/contract/src/v1/order/order.dto.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { OrderSchema, CreateOrderCommandSchema } from './order.dto'
import { money } from '../core/money'

const validOrder = {
  id: 'o1', orderNumber: 'ORD-123', status: 'PENDING',
  totalAmount: money(509990, 'LKR'),
  shippingAddress: {
    fullName: 'A B', addressLine1: '1 St', city: 'Colombo', state: 'WP',
    postalCode: '00100', country: 'Sri Lanka', phone: '+94770000000',
  },
  deliveryMethod: 'SHIP' as const,
  items: [{ variantId: 'v1', quantity: 2, priceAtPurchase: money(249900, 'LKR'), productName: 'Tee' }],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('order DTOs', () => {
  it('accepts a valid order', () => expect(OrderSchema.safeParse(validOrder).success).toBe(true))
  it('rejects a bad status', () => {
    const bad = { ...validOrder, status: 'SHIPPED' }
    expect(OrderSchema.safeParse(bad).success).toBe(false)
  })
  it('rejects COLLECT order missing optional line2 but keeps it optional', () => {
    const cmd = CreateOrderCommandSchema.safeParse({
      shippingAddress: validOrder.shippingAddress, deliveryMethod: 'COLLECT',
    })
    expect(cmd.success).toBe(true)
  })
  it('rejects command with bad deliveryMethod', () => {
    const bad = CreateOrderCommandSchema.safeParse({
      shippingAddress: validOrder.shippingAddress, deliveryMethod: 'DRONE',
    })
    expect(bad.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run, expect failure** — `npm test` → FAIL (module not found).

- [ ] **Step 3: Implement.** `order.dto.ts`:

```ts
import { z } from 'zod'
import { MoneySchema } from '../core/money'

export const OrderStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'FULFILLED', 'CANCELLED'])
export const DeliveryMethodSchema = z.enum(['SHIP', 'COLLECT'])

export const ShippingAddressSchema = z.object({
  fullName: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().min(1),
})
export type ShippingAddressDTO = z.infer<typeof ShippingAddressSchema>

export const OrderItemSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int().positive(),
  priceAtPurchase: MoneySchema,
  productName: z.string(),
  productImage: z.string().optional(),
})
export type OrderItemDTO = z.infer<typeof OrderItemSchema>

export const OrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: OrderStatusSchema,
  totalAmount: MoneySchema,
  shippingAddress: ShippingAddressSchema,
  deliveryMethod: DeliveryMethodSchema,
  paymentProof: z.string().optional(),
  items: z.array(OrderItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type OrderDTO = z.infer<typeof OrderSchema>

export const CreateOrderCommandSchema = z.object({
  shippingAddress: ShippingAddressSchema,
  deliveryMethod: DeliveryMethodSchema,
  email: z.string().email().optional(),
})
export type CreateOrderCommand = z.infer<typeof CreateOrderCommandSchema>
```

`order.service.ts`:

```ts
import type { Result } from '../core/result'
import type { OrderDTO, CreateOrderCommand } from './order.dto'

export interface OrderService {
  /** Creates an order from the user's cart (server-side totals), then clears the cart. Empty cart → VALIDATION. */
  createOrder(userId: string, command: CreateOrderCommand): Promise<Result<OrderDTO>>
  /** Owner-only read; someone else's order → UNAUTHORIZED; unknown id → NOT_FOUND. */
  getOrder(userId: string, orderId: string): Promise<Result<OrderDTO>>
  listOrders(userId: string): Promise<Result<OrderDTO[]>>
  /** Records the MinIO URL of an uploaded payment proof (upload itself is app-side). */
  attachPaymentProof(userId: string, orderId: string, proofUrl: string): Promise<Result<OrderDTO>>
}
```

Add to `cart.service.ts` (inside the interface):

```ts
  /** Moves the source owner's lines into the user cart (validating/healing like addItem). Returns the USER cart. */
  mergeCarts(from: CartOwner, toUserId: string): Promise<Result<CartMutation>>
```

Append to `packages/contract/src/v1/index.ts`:

```ts
export * from './order/order.dto'
export * from './order/order.service'
```

**Before finalizing (verification duty):** read `packages/engine/src/repositories/order.repository.ts:5-36` (`OrderWithItems`, item shape) and the order UI clients (`OrderConfirmationClient.tsx`, `OrdersPageClient.tsx`, `PaymentPageClient.tsx`) — confirm which display fields (product name/image) exist on stored order items; if items carry nothing beyond variantId/quantity/priceAtPurchase, drop `productName`/`productImage` from `OrderItemDTO` and note it (the UI then hydrates from catalog by variantId — check it doesn't already). Adjust the dto + test to reality.

- [ ] **Step 4: Tests green + snapshot additive**

```bash
npm test        # 38 + 4 = 42 passed / 17 skipped
npm run audit:api
git diff --stat -- packages/contract/etc   # additions only
```

- [ ] **Step 5: Commit** — `git commit -m "feat(contract): v1 order DTOs, OrderService, CartService.mergeCarts"`

---

### Task 3: Order conformance suite + world additions

**Files:**
- Create: `packages/contract/src/testing/order-conformance.ts`
- Modify: `packages/contract/src/testing/index.ts`

**Interfaces:**
- Consumes: `runCartConformance`'s runner shape (`CatalogService & CartService`) — order suite needs `& v1.OrderService` too; `cartWorld` user + catalog world variants
- Produces: `runOrderConformance(suiteName: string, makeService: () => v1.CatalogService & v1.CartService & v1.OrderService)`

- [ ] **Step 1: The suite** — `packages/contract/src/testing/order-conformance.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { v1 } from '../v1'

const address: v1.ShippingAddressDTO = {
  fullName: 'Conformance Buyer', addressLine1: '1 Test St', city: 'Colombo', state: 'WP',
  postalCode: '00100', country: 'Sri Lanka', phone: '+94770000000',
}

export function runOrderConformance(
  suiteName: string,
  makeService: () => v1.CatalogService & v1.CartService & v1.OrderService,
) {
  describe(`${suiteName}: OrderService v1 conformance`, () => {
    it('createOrder computes totals server-side: SHIP under 100 charges 9.99 shipping', async () => {
      const s = makeService()
      const user = 'conformance-cart-user'
      await s.clearCart({ kind: 'user', userId: user })
      await s.addItem({ kind: 'user', userId: user }, 'conformance-v1', 1) // 2499.00
      const r = await s.createOrder(user, { shippingAddress: address, deliveryMethod: 'SHIP' })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      // subtotal 2499.00 + shipping 9.99 = 2508.99
      expect(r.data.totalAmount).toEqual({ amountMinor: 250899, currency: 'LKR' })
      expect(r.data.status).toBe('PENDING')
      expect(r.data.items[0]).toMatchObject({ variantId: 'conformance-v1', quantity: 1 })
      // cart cleared by a successful order
      const cart = await s.getCart({ kind: 'user', userId: user })
      expect(cart.ok && cart.data.cart.itemCount).toBe(0)
    })

    it('createOrder SHIP at/over 100 ships free; COLLECT never charges shipping', async () => {
      const s = makeService()
      const user = 'conformance-cart-user'
      await s.clearCart({ kind: 'user', userId: user })
      await s.addItem({ kind: 'user', userId: user }, 'conformance-v3', 1) // 4999.00
      const a = await s.createOrder(user, { shippingAddress: address, deliveryMethod: 'SHIP' })
      expect(a.ok && a.data.totalAmount).toEqual({ amountMinor: 499900, currency: 'LKR' })
      await s.addItem({ kind: 'user', userId: user }, 'conformance-v1', 1)
      const b = await s.createOrder(user, { shippingAddress: address, deliveryMethod: 'COLLECT' })
      expect(b.ok && b.data.totalAmount).toEqual({ amountMinor: 249900, currency: 'LKR' })
    })

    it('empty cart → VALIDATION', async () => {
      const s = makeService()
      const user = 'conformance-cart-user'
      await s.clearCart({ kind: 'user', userId: user })
      const r = await s.createOrder(user, { shippingAddress: address, deliveryMethod: 'SHIP' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.code).toBe('VALIDATION')
    })

    it('getOrder enforces ownership; listOrders returns the user’s orders', async () => {
      const s = makeService()
      const user = 'conformance-cart-user'
      await s.clearCart({ kind: 'user', userId: user })
      await s.addItem({ kind: 'user', userId: user }, 'conformance-v1', 1)
      const created = await s.createOrder(user, { shippingAddress: address, deliveryMethod: 'SHIP' })
      expect(created.ok).toBe(true)
      if (!created.ok) return
      const got = await s.getOrder(user, created.data.id)
      expect(got.ok && got.data.orderNumber).toBe(created.data.orderNumber)
      const stranger = await s.getOrder('someone-else', created.data.id)
      expect(stranger.ok).toBe(false)
      if (!stranger.ok) expect(stranger.error.code).toBe('UNAUTHORIZED')
      const listed = await s.listOrders(user)
      expect(listed.ok && listed.data.some((o) => o.id === created.data.id)).toBe(true)
      await s.clearCart({ kind: 'user', userId: user }) // leave world consistent
    })

    it('attachPaymentProof records the URL (owner-only)', async () => {
      const s = makeService()
      const user = 'conformance-cart-user'
      await s.clearCart({ kind: 'user', userId: user })
      await s.addItem({ kind: 'user', userId: user }, 'conformance-v1', 1)
      const created = await s.createOrder(user, { shippingAddress: address, deliveryMethod: 'COLLECT' })
      if (!created.ok) throw new Error('setup failed')
      const r = await s.attachPaymentProof(user, created.data.id, 'http://minio.test/proofs/p1.png')
      expect(r.ok && r.data.paymentProof).toBe('http://minio.test/proofs/p1.png')
      const stranger = await s.attachPaymentProof('someone-else', created.data.id, 'http://x/y.png')
      expect(stranger.ok).toBe(false)
      await s.clearCart({ kind: 'user', userId: user })
    })

    it('mergeCarts moves guest lines into the user cart, healing dead variants', async () => {
      const s = makeService()
      const user = 'conformance-cart-user'
      await s.clearCart({ kind: 'user', userId: user })
      const r = await s.mergeCarts(
        { kind: 'guest', items: [
          { variantId: 'conformance-v1', quantity: 2 },
          { variantId: 'vanished-variant', quantity: 1 },
        ] },
        user,
      )
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.data.cart.itemCount).toBe(2)
      expect(r.data.guestItems).toBeUndefined() // user carts never echo guest lines
      await s.clearCart({ kind: 'user', userId: user })
    })
  })
}
```

Append to `packages/contract/src/testing/index.ts`: `export * from './order-conformance'`.

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc -p packages/contract/tsconfig.json --noEmit
git add packages/contract
git commit -m "feat(contract): order conformance suite (totals, ownership, proof, mergeCarts)"
```

---

### Task 4: Engine — order.repository threading + OrderService + mergeCarts

**Files:**
- Create: `packages/engine/src/order.ts`, `packages/engine/src/mappers/order.mapper.ts`
- Modify: `packages/engine/src/repositories/order.repository.ts` (database threading, all 7 functions), `packages/engine/src/cart.ts` (mergeCarts), `packages/engine/src/engine.ts` (`TenantEngine.order`)
- Test: `packages/engine/src/mappers/order.mapper.test.ts`

**Interfaces:**
- Consumes: order.repository functions (threaded like Phase 2 Task 1); `CartService.getCart`/`clearCart` internals; `fromMajorAmount`
- Produces: `createOrderService(config: EngineConfig, tenant: TenantRef): v1.OrderService`; `TenantEngine.order`; `CartService.mergeCarts`

- [ ] **Step 1: Thread order.repository** — optional `database?: string` last param on all 7 exported functions (`getSession(database)`), internal delegations forward. Pure threading, no logic change.

- [ ] **Step 2: Failing mapper tests** — `packages/engine/src/mappers/order.mapper.test.ts` (mirror cart mapper tests: major→minor totals, deprecated drops none here — assert `OrderSchema.parse` passes on a mapped repo order with `priceAtPurchase` 2499 → `249900`, `totalAmount` 2508.99 → `250899`, and any repo-only fields the DTO doesn't carry are absent):

```ts
import { describe, it, expect } from 'vitest'
import { v1 } from '@softx/contract'
import { toOrderDTO } from './order.mapper'

const repoOrder = {
  id: 'o1', orderNumber: 'ORD-1', userId: 'u1', status: 'PENDING', totalAmount: 2508.99,
  shippingAddress: { fullName: 'A B', addressLine1: '1 St', city: 'C', state: 'S', postalCode: 'P', country: 'LK', phone: 'T' },
  deliveryMethod: 'SHIP', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  items: [{ id: 'oi1', orderId: 'o1', variantId: 'v1', quantity: 2, priceAtPurchase: 2499, productName: 'Tee' }],
} as never

describe('toOrderDTO', () => {
  it('maps money to minor units and parses against the contract schema', () => {
    const dto = toOrderDTO(repoOrder, 'LKR')
    expect(dto.totalAmount).toEqual({ amountMinor: 250899, currency: 'LKR' })
    expect(dto.items[0].priceAtPurchase).toEqual({ amountMinor: 249900, currency: 'LKR' })
    expect(() => v1.OrderSchema.parse(dto)).not.toThrow()
    expect(dto).not.toHaveProperty('userId') // ownership stays server-side, never in the DTO
  })
})
```

(Adjust the fixture to the REAL `OrderWithItems` item shape found in Task 2's verification duty — same rule.)

- [ ] **Step 3: Implement mappers** (`toOrderDTO(order: OrderWithItems, currency): v1.OrderDTO`) and the service. Key logic in `createOrder` (parity with `order.ts:45-58`):

```ts
const FREE_SHIPPING_THRESHOLD_MINOR = 100_00      // subtotal >= 100.00 → free (parity: subtotal >= 100)
const SHIP_COST_MINOR = 999                       // 9.99
const subtotalMinor = cart.items.reduce((n, i) => n + i.product.price.stock.amountMinor * i.quantity, 0)
const shippingMinor = command.deliveryMethod === 'SHIP'
  ? (subtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR ? 0 : SHIP_COST_MINOR)
  : 0
```

then call `orderRepo.createOrder({ userId, items: cart.items.map(i => ({ variantId: i.variantId, quantity: i.quantity, priceAtPurchase: amount(i.product.price.stock) })), shippingAddress: command.shippingAddress, deliveryMethod: command.deliveryMethod, totalAmount: (subtotalMinor + shippingMinor) / 100 }, db)` and on success `cartRepo.clearCart(userId, db)`. Ownership: `getOrder`/`attachPaymentProof` load the order, `order.userId !== userId → err('UNAUTHORIZED', ...)`; null order → NOT_FOUND. Read the repo's `createOrder` FIRST and adapt the input (orderNumber generation, item node creation) to its real signature — the service's own signature is the contract and must not change; record adaptations in the report. **Never leak `userId` into the DTO** — if the repo returns it, the mapper drops it (the mapper test asserts this).

`mergeCarts` in `cart.ts`: hydrate `from` lines exactly like `guestResult` does, then for each surviving line `cartRepo.addToCart(toUserId, line.variantId, line.quantity, db)`, return `ok({ cart: <user cart> })` (no guestItems echo).

- [ ] **Step 4: Verify + commit**

```bash
npm test   # 42 + 1 = 43 passed / 17 skipped
npx tsc --noEmit -p packages/engine/tsconfig.json
JWT_SECRET=... npm run build   # canonical prefix
git commit -m "feat(engine): OrderService v1 — server-side totals, ownership, mergeCarts; order.repository threading"
```

---

### Task 5: engine-fixtures — fake OrderService + mergeCarts

**Files:**
- Create: `packages/engine-fixtures/src/fake-order.ts`
- Create: `packages/engine-fixtures/src/fake-order.conformance.test.ts`
- Modify: `packages/engine-fixtures/src/fake-cart.ts` (mergeCarts), `fake-engine.ts` (expose `order`)

**Interfaces:**
- Produces: `createFakeOrderService()` — in-memory orders (id `ord-N`, orderNumber `ORD-N`, status PENDING, createdAt fixed ISO), computing totals with the SAME constants as the engine (export `FREE_SHIPPING_THRESHOLD_MINOR`/`SHIP_COST_MINOR` from `@softx/contract/testing`? No — recompute from worldProducts prices: subtotal from `price.stock.amountMinor`, shipping rule duplicated as literals with a comment "parity with engine/src/order.ts"; fake orders persist per service instance so `getOrder`/`listOrders`/`attachPaymentProof` read them back); fake `mergeCarts` mutates the shared user-carts map (the fake cart service must expose it — restructure `fake-cart.ts` so both fns share one `userCarts` instance per runner: create `createFakeCartState()` returning `{ userCarts, cartService }` and have `fake-order`'s conformance runner use the same state).

Conformance runner: `runOrderConformance('engine-fixtures', () => { const state = createFakeCartState(); return { ...createFakeCatalogService(), ...state.cartService, ...createFakeOrderService(state) } })` — after this task `npm test` = 43 + 6 = **49 passed / 17 skipped**.

Verify + commit: `git commit -m "feat(engine-fixtures): fake order service + mergeCarts passing order conformance"`.

---

### Task 6: Real-engine order conformance (integration)

**Files:**
- Create: `packages/engine/test/order.integration.test.ts`

Copy the cart integration structure (skip gate, driver, catalog→cart seed order, pre/post teardown incl. the uuid-escape clause + `MATCH (o:Order) WHERE ... DETACH DELETE` — orders created by the suite get repo-generated ids/numbers; teardown via `MATCH (o:Order)-[:CONTAINS_ITEM]->()` — READ order.repository first for the real label/rel names and use an id/number prefix or the conformance user linkage `MATCH (u:User {id:'conformance-cart-user'})-[:PLACED_ORDER|HAS_ORDER]->(o:Order) DETACH DELETE o`, whatever matches reality). Runner: `runOrderConformance('real-engine', () => { const t = engine.for({clientId:'conformance'}); return { ...t.catalog, ...t.cart, ...t.order } })`. After: `NEO4J_PASSWORD=ecommerce123 npm run test:integration` = **26 passed** (20 + 6); `npm test` = 49 passed / 26 skipped; DB left at 0 conformance nodes (verify with cypher-shell like Phase 2).

Commit: `git commit -m "test(engine): real-engine order conformance run"`.

---

### Task 7: App switch — order/payment actions + login merge + checkout UI

**Files:**
- Modify: `apps/factorybay/src/lib/engine.ts` (add `getOrderService()`), `apps/factorybay/src/app/actions/order.ts` (wrappers), `apps/factorybay/src/app/actions/payment.ts` (upload then `attachPaymentProof`), `apps/factorybay/src/app/actions/auth.ts` (login merge via `getCartService().mergeCarts`), `apps/factorybay/src/app/[locale]/checkout/CheckoutPageClient.tsx` (Money shapes + fix the `$Rs {shipping...}` template-literal bug at line ~414 → `Rs {amount(...)}`), `apps/factorybay/src/app/[locale]/orders/OrdersPageClient.tsx`, `apps/factorybay/src/app/[locale]/order/[id]/OrderConfirmationClient.tsx`, `apps/factorybay/src/app/[locale]/order/[id]/payment/PaymentPageClient.tsx` (whatever consumes order shapes — enumerate with `grep -rn "totalAmount\|priceAtPurchase\|OrderWithItems\|orderNumber" apps/factorybay/src --include="*.tsx" | grep -v admin`)

**Interfaces:**
- Consumes: `v1.OrderService`, `v1.CartService.mergeCarts`; keep every action name + envelope key
- Produces: `getOrder()`/`getUserOrders()`/`createOrder()` data becomes OrderDTO-shaped (Money totals); login merge heals + continues past dead lines (replacing the raw loop at `auth.ts:140-154`)

- [ ] **Step 1: order.ts wrappers** — same pattern as cart: `createOrderAction` keeps its logged-in guard + friendly messages, then `getOrderService().createOrder(userId, {shippingAddress, deliveryMethod, email})`; map `r.error.code` → today's message strings (`VALIDATION` → 'Your cart is empty', others → r.error.message). `getOrderAction`/`getUserOrdersAction` → service (drop the manual ownership check — service does it; translate UNAUTHORIZED → 'Unauthorized'). `updateOrderStatusAction` UNTOUCHED (admin, Phase 5).
- [ ] **Step 2: payment.ts** — keep the whole upload block (cookie auth, MinIO `uploadFile`) as-is; replace the final `updateOrderPaymentProof(...)` call with `getOrderService().attachPaymentProof(userId, orderId, proofUrl)`; return `{success:true, data:{proofUrl}}` envelope unchanged.
- [ ] **Step 3: auth.ts login merge** — replace the raw loop:

```ts
    // Migrate guest cart to user cart (heals vanished variants; one bad line
    // no longer aborts the rest — the service skips what it cannot validate)
    try {
      const guestCart = (await getGuestCart()).filter((l) => l.quantity >= 1)
      if (guestCart.length > 0) {
        const r = await getCartService().mergeCarts({ kind: 'guest', items: guestCart }, user.id)
        if (r.ok) await clearGuestCart().catch(() => {})
      }
    } catch (error) {
      console.error('Cart migration error:', error) // don't fail login if migration fails
    }
```

- [ ] **Step 4: consumers** — every storefront order read: `order.totalAmount` (number) → `amount(order.totalAmount)`; `item.priceAtPurchase` → `amount(item.price.priceAtPurchase)`... precisely: `priceAtPurchase` becomes Money → `amount(o.priceAtPurchase)`; fix the CheckoutPageClient `$Rs {shipping.toFixed(2)}` literal-braces bug (render `Rs {amount(...)}` consistently with the rest of the page); OrderConfirmation/Payment/Orders clients per the grep enumeration. Admin order pages (AdminOrdersClient) keep repository shapes this phase — exclude them.
- [ ] **Step 5: Verify** — canonical build; `npm test` 49/26; grep: `stockPrice|retailPrice|totalAmount: number|priceAtPurchase: number` gone from storefront order paths (grep -rn "priceAtPurchase\|totalAmount" apps/factorybay/src --include="*.tsx" | grep -v admin → each hit uses `amount(` or Money).
- [ ] **Step 6: Commit** — `git commit -m "feat(app): orders/checkout on OrderService — Money totals, healed login merge, $Rs display fix"`

---

### Task 8: Smoke (order journey) + docs + final verification

**Files:**
- Create: `apps/factorybay/e2e/order.spec.ts`
- Modify: `CLAUDE.md` (Phase 3 note)

- [ ] **Step 1: The full golden journey** — uses the seeded customer from `npm run db:seed` (test@example.com / Customer123; verify in `apps/factorybay/scripts/seed-db.ts` and adjust): login → add SMOKE-UST-001 to cart → `/en/checkout` → fill the shipping form (read `CheckoutPageClient.tsx` for the real fields/labels — verification duty) → place order → expect the confirmation's order-number text and `/en/orders` listing it. Clean up: the order stays in the DB (acceptable for a dev DB — note it in the spec header; do NOT delete by hand — or filter assertions to "at least one order exists").
- [ ] **Step 2: Full matrix** — smoke 4 passed; clean SMOKE products; integration 26; unit 49/26; canonical build; `npm run audit:api` + etc/ clean.
- [ ] **Step 3: CLAUDE.md** — extend the engine paragraph: "Orders/checkout (Phase 3): OrderService computes totals server-side (free SHIP over 100.00, else 9.99), enforces ownership, records payment proofs; login merges the guest cart through the service."
- [ ] **Step 4: Commit** — `git commit -m "test(app): order smoke journey + Phase 3 docs"`

---

## Definition of Done (Phase 3)

- [ ] Cart conformance pins (3 new tests) pass on fixtures AND real engine (20 integration)
- [ ] Contract v1 additive: order DTOs, OrderService (4 methods), CartService.mergeCarts; snapshot regenerated, gate clean
- [ ] Order conformance (6 tests) on both runners (26 integration total); DB left clean
- [ ] Totals/shipping computed engine-side with parity; ownership enforced in the service; userId never in DTOs
- [ ] App: order/payment actions are wrappers; login merge heals through the service; storefront order UI on Money; `$Rs` display bug fixed
- [ ] Smoke covers login → cart → checkout → order (4 specs total); full matrix green
