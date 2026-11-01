import { v1 } from '@softx/contract'
import type { EngineConfig, TenantRef } from './engine'
import { toCartItemDTO, cartTotal } from './mappers/cart.mapper'
import * as cartRepo from './repositories/cart.repository'
import * as productRepo from './repositories/product.repository'

const { ok, err } = v1

/** Pure guest-line reducer — the cookie model, engine-side. */
function guestAdd(items: v1.GuestCartLine[], variantId: string, quantity: number): v1.GuestCartLine[] {
  const existing = items.find((l) => l.variantId === variantId)
  if (!existing) return [...items, { variantId, quantity }]
  return items.map((l) => (l.variantId === variantId ? { ...l, quantity: l.quantity + quantity } : l))
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
        const updated = await cartRepo.updateCartItemQuantity(owner.userId, variantId, quantity, db)
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
  }
}
