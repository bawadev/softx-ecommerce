// `v1` (ok/err/money) comes from the contract root; the test world fixtures
// come from the `@softx/contract/testing` subpath (the root barrel deliberately
// does not re-export `testing` — it imports vitest and must stay out of app
// runtimes).
import { v1 } from '@softx/contract'
import { worldProducts, worldCurrency } from '@softx/contract/testing'

const { ok, err } = v1

/** Locate a variant in the catalog fixture world; null → vanished variant. */
function worldVariant(variantId: string): { product: v1.ProductDTO; variant: v1.ProductVariantDTO } | null {
  for (const product of worldProducts) {
    const variant = product.variants.find((v) => v.id === variantId)
    if (variant) return { product, variant }
  }
  return null
}

/** Pure guest-line reducer — the cookie model, same shape as the engine's guestAdd. */
function guestAdd(items: v1.GuestCartLine[], variantId: string, quantity: number): v1.GuestCartLine[] {
  const existing = items.find((l) => l.variantId === variantId)
  if (!existing) return [...items, { variantId, quantity }]
  return items.map((l) => (l.variantId === variantId ? { ...l, quantity: l.quantity + quantity } : l))
}

/**
 * Shared per-runner fake cart state: the user-carts storage map plus the cart
 * service that reads and mutates it. The fake ORDER service (fake-order.ts)
 * needs the same cart state — createOrder reads the user's cart to compute
 * totals and a successful order clears it — so a runner composing cart +
 * order services must build ONE state instance and share it, exactly like
 * `createFakeEngine().for()` and the order conformance runner do.
 */
export interface FakeCartState {
  userCarts: Map<string, v1.GuestCartLine[]>
  cartService: v1.CartService
}

/**
 * Fake cart service state v1. Users get in-memory carts keyed by userId
 * (guest lines double as the storage shape); guests get the pure cookie-line
 * reducer. Hydration reads the catalog fixture world directly, so prices and
 * totals always come from worldProducts' actual price.stock values — never
 * re-hardcoded here. Semantics mirror the engine's CartService (the
 * contract): guest mutations echo HEALED guestItems, addItem on an unknown
 * variant fails NOT_FOUND before any user state is touched, and updateItem on
 * a missing line is NOT_FOUND for both owner kinds.
 */
export function createFakeCartState(): FakeCartState {
  // Pre-seeded to mirror cartWorld.seedCypher (conformance-cart-user holds
  // 2 × conformance-v1); the Cypher is not parseable, so the state is stated.
  const userCarts = new Map<string, v1.GuestCartLine[]>([
    ['conformance-cart-user', [{ variantId: 'conformance-v1', quantity: 2 }]],
  ])

  function hydrate(lines: v1.GuestCartLine[]): v1.CartItemDTO[] {
    const out: v1.CartItemDTO[] = []
    for (const line of lines) {
      const found = worldVariant(line.variantId)
      if (!found) continue // self-heal: vanished variant drops out
      out.push({
        variantId: line.variantId,
        quantity: line.quantity,
        product: {
          id: found.product.id,
          name: found.product.name,
          brand: found.product.brand,
          sku: found.product.sku,
          images: found.product.images,
          price: { stock: found.product.price.stock, retail: found.product.price.retail },
        },
        variant: {
          id: found.variant.id,
          size: found.variant.size,
          color: found.variant.color,
          stockQuantity: found.variant.stockQuantity,
        },
      })
    }
    return out
  }

  function cartFrom(items: v1.CartItemDTO[]): v1.CartDTO {
    return {
      items,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      // cartTotal parity with the engine's cart.mapper.
      total: v1.money(
        items.reduce((sum, i) => sum + i.product.price.stock.amountMinor * i.quantity, 0),
        worldCurrency,
      ),
    }
  }

  // Guest results echo the healed line list (vanished variants drop out of
  // guestItems too, not just the rendered cart) — engine contract.
  function guestResult(lines: v1.GuestCartLine[]): v1.Result<v1.CartMutation> {
    const hydrated = hydrate(lines)
    return ok({
      cart: cartFrom(hydrated),
      guestItems: hydrated.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    })
  }

  function userResult(userId: string): v1.Result<v1.CartMutation> {
    return ok({ cart: cartFrom(hydrate(userCarts.get(userId) ?? [])) })
  }

  const cartService: v1.CartService = {
    async getCart(owner) {
      if (owner.kind === 'guest') return guestResult(owner.items)
      return userResult(owner.userId)
    },

    async addItem(owner, variantId, quantity = 1) {
      if (quantity < 1) return err('VALIDATION', 'Quantity must be at least 1')
      // Unknown variant → NOT_FOUND before any user state is touched.
      if (!worldVariant(variantId)) return err('NOT_FOUND', `Variant ${variantId} not found`)
      if (owner.kind === 'guest') return guestResult(guestAdd(owner.items, variantId, quantity))
      userCarts.set(owner.userId, guestAdd(userCarts.get(owner.userId) ?? [], variantId, quantity))
      return userResult(owner.userId)
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
      return userResult(owner.userId)
    },

    async removeItem(owner, variantId) {
      if (owner.kind === 'guest') return guestResult(owner.items.filter((l) => l.variantId !== variantId))
      userCarts.set(owner.userId, (userCarts.get(owner.userId) ?? []).filter((l) => l.variantId !== variantId))
      return userResult(owner.userId)
    },

    async clearCart(owner) {
      if (owner.kind === 'guest') return guestResult([])
      userCarts.set(owner.userId, [])
      return userResult(owner.userId)
    },

    // Merge: hydrate the source lines exactly like guest flows (dead variants
    // heal away), then move each surviving line into the user's map via
    // guestAdd (increment-if-exists — the same reducer addItem uses). A user
    // source is drained: its lines are moved, not copied, mirroring the
    // guest cookie being consumed on login-merge (guest callers clear their
    // cookie themselves; guest state is not ours to mutate). Returns the
    // USER cart only — no guestItems echo (contract doc).
    async mergeCarts(from, toUserId) {
      const source = from.kind === 'guest' ? from.items : (userCarts.get(from.userId) ?? [])
      if (from.kind === 'user') userCarts.set(from.userId, [])
      for (const line of source) {
        if (!worldVariant(line.variantId)) continue // self-heal: vanished variant drops out
        userCarts.set(toUserId, guestAdd(userCarts.get(toUserId) ?? [], line.variantId, line.quantity))
      }
      return userResult(toUserId)
    },
  }

  return { userCarts, cartService }
}

/**
 * Backwards-compatible standalone cart service owning its own state — use
 * createFakeCartState() directly when an order service must share the cart.
 */
export function createFakeCartService(): v1.CartService {
  return createFakeCartState().cartService
}
