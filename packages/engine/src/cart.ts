import { v1 } from '@softx/contract'
import type { EngineConfig, TenantRef } from './engine'
import { toCartItemDTO, cartTotal } from './mappers/cart.mapper'
import { convertNeo4jIntegers } from './neo4j-utils'
import * as cartRepo from './repositories/cart.repository'
import * as productRepo from './repositories/product.repository'

const { ok, err } = v1

/** Pure guest-line reducer — the cookie model, engine-side. */
function guestAdd(items: v1.GuestCartLine[], variantId: string, targetQuantity: number): v1.GuestCartLine[] {
  const existing = items.find((l) => l.variantId === variantId)
  if (!existing) return [...items, { variantId, quantity: targetQuantity }]
  return items.map((l) => (l.variantId === variantId ? { ...l, quantity: targetQuantity } : l))
}

/**
 * LKD-46: capped line quantity for a stock level — pure for hermetic tests.
 * `requested` is the DELTA for add-to-cart; the resulting line never exceeds
 * `stockQuantity`, and a zero/negative stock yields 0 (nothing addable).
 */
export function clampLineQuantity(currentQuantity: number, requested: number, stockQuantity: number): number {
  if (stockQuantity <= 0) return 0
  return Math.min(currentQuantity + requested, stockQuantity)
}

/** LKD-46: normalized stock for a raw variant row (stockQuantity may be a Neo4j Integer). */
export function stockOfVariant(variant: unknown): number {
  const stock = convertNeo4jIntegers(variant as Record<string, unknown>).stockQuantity
  return typeof stock === 'number' ? stock : 0
}

/**
 * Cart service v1. Users get the DB-backed cart (cart.repository, tenant
 * database threaded); guests get the pure cookie-line reducer with
 * hydration through the product repository — no guest state is persisted.
 *
 * getVariantWithProduct returns raw Neo4j records ({ variant: full
 * ProductVariant, product: summary projection }) whose integer properties
 * (stockPrice, retailPrice, stockQuantity) arrive as Neo4j Integer
 * objects; hydration funnels through toCartItemDTO, which normalizes the
 * row with convertNeo4jIntegers before mapping, so one code path produces
 * every CartItemDTO.
 */
export function createCartService(config: EngineConfig, _tenant: TenantRef): v1.CartService {
  const currency = config.defaultCurrency ?? 'LKR'
  const db = config.neo4j.database

  async function hydrateGuest(items: v1.GuestCartLine[]): Promise<v1.CartItemDTO[]> {
    const out: v1.CartItemDTO[] = []
    for (const line of items) {
      const data = await productRepo.getVariantWithProduct(line.variantId, db)
      if (!data) continue // self-heal: vanished variant drops out
      // The mapper reads only variantId/quantity/product/variant; the other
      // CartItem fields are inert filler so the hydrated row type-checks.
      out.push(
        toCartItemDTO(
          {
            id: '',
            userId: '',
            addedAt: '',
            variantId: line.variantId,
            quantity: line.quantity,
            product: data.product,
            variant: data.variant,
          },
          currency
        )
      )
    }
    return out
  }

  function cartFrom(items: v1.CartItemDTO[]): v1.CartDTO {
    return { items, itemCount: items.reduce((n, i) => n + i.quantity, 0), total: cartTotal(items, currency) }
  }

  async function guestResult(items: v1.GuestCartLine[]): Promise<v1.Result<v1.CartMutation>> {
    const hydrated = await hydrateGuest(items)
    return ok({
      cart: cartFrom(hydrated),
      guestItems: hydrated.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    })
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
        // LKD-46: cap the line at available stock — the "Only N left in stock"
        // badge is now authoritative, not cosmetic.
        const stock = stockOfVariant(exists.variant)
        if (stock <= 0) return err('VALIDATION', 'Out of stock')
        if (owner.kind === 'guest') {
          const current = owner.items.find((l) => l.variantId === variantId)?.quantity ?? 0
          return await guestResult(guestAdd(owner.items, variantId, clampLineQuantity(current, quantity, stock)))
        }
        await cartRepo.addToCart(owner.userId, variantId, quantity, db, stock)
        return await this.getCart(owner)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to add item', { cause: String(e) })
      }
    },

    async updateItem(owner, variantId, quantity) {
      try {
        if (quantity < 1) return err('VALIDATION', 'Quantity must be at least 1')
        const exists = await productRepo.getVariantWithProduct(variantId, db)
        if (!exists) return err('NOT_FOUND', `Variant ${variantId} not found`)
        const stock = stockOfVariant(exists.variant)
        if (stock <= 0) return err('VALIDATION', 'Out of stock')
        // LKD-46: an explicit set can still never exceed the live stock.
        const capped = Math.min(quantity, stock)
        if (owner.kind === 'guest') {
          if (!owner.items.some((l) => l.variantId === variantId)) {
            return err('NOT_FOUND', `Cart line for ${variantId} not found`)
          }
          return await guestResult(
            owner.items.map((l) => (l.variantId === variantId ? { ...l, quantity: capped } : l))
          )
        }
        const updated = await cartRepo.updateCartItemQuantity(owner.userId, variantId, capped, db)
        if (!updated) return err('NOT_FOUND', `Cart line for ${variantId} not found`)
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

    // Move the source owner's lines into the user cart. A user→SAME-user
    // merge is a NO-OP returning the cart unchanged (naively replaying the
    // moves would double quantities and then wipe the cart via the source
    // clear — pinned by the conformance suite). Otherwise the source lines
    // are hydrated exactly like guestResult does (vanished variants
    // self-heal out — guest lines via getVariantWithProduct, user lines via
    // the cart JOIN), each surviving line is added with addToCart (which
    // increments an existing line), a user source cart is cleared
    // afterwards, and the USER cart is returned — user carts never echo
    // guestItems.
    async mergeCarts(from, toUserId) {
      try {
        if (from.kind === 'user' && from.userId === toUserId) {
          const own = await cartRepo.getCartItems(toUserId, db)
          return ok({ cart: cartFrom(own.map((r) => toCartItemDTO(r, currency))) })
        }
        const source =
          from.kind === 'guest'
            ? await hydrateGuest(from.items)
            : (await cartRepo.getCartItems(from.userId, db)).map((r) => toCartItemDTO(r, currency))
        for (const line of source) {
          // LKD-46: merges are capped per line too (DTO stockQuantity is
          // already normalized by the mapper).
          await cartRepo.addToCart(toUserId, line.variantId, line.quantity, db, line.variant.stockQuantity)
        }
        if (from.kind === 'user') await cartRepo.clearCart(from.userId, db)
        const rows = await cartRepo.getCartItems(toUserId, db)
        return ok({ cart: cartFrom(rows.map((r) => toCartItemDTO(r, currency))) })
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to merge carts', { cause: String(e) })
      }
    },
  }
}
