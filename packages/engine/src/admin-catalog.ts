import { v1 } from '@softx/contract'
import type { Session } from 'neo4j-driver'
import type { EngineConfig, TenantRef } from './engine'
import { getSession } from './db'
import {
  toProductDTO,
  toCategoryDTO,
  toPromotionalCategoryDTO,
  toHeroSlideDTO,
  toColorDTO,
} from './mappers/catalog.mapper'
import * as productRepo from './repositories/product.repository'
import * as categoryRepo from './repositories/category.repository'
import * as promoRepo from './repositories/promotional-category.repository'
import * as heroRepo from './repositories/hero-slide.repository'
import * as colorRepo from './repositories/color.repository'

const { ok, err } = v1

/**
 * AdminCatalogService v1 (Phase 5 Task 3) — the admin write surface over the
 * same repositories the app actions used to call directly.
 *
 * Authorization: every method's FIRST statement checks the per-call ActorRef
 * (the contract passes it as the first argument) and returns
 * UNAUTHORIZED ('Admin access required') BEFORE any repository or session
 * work — a non-admin against an unknown id answers UNAUTHORIZED, never
 * NOT_FOUND (pinned by the admin conformance suite). The optional `_actor`
 * captured by `engine.for(tenant, actor)` is deliberately NOT consulted:
 * the per-call actor is always authoritative.
 *
 * Repository signature adaptations (same disciplines as catalog.ts):
 * - product.repository functions take an optional trailing `database`
 *   argument (their own sessions); every call forwards
 *   `config.neo4j.database`.
 * - category/promotional-category/hero-slide/color repositories take a
 *   Neo4j `Session` first; `withSession` opens one per call and closes it
 *   in `finally`.
 * - Single category add/remove and the unvalidated bulk replace had no
 *   repository home (the actions ran the Cypher inline); Phase 5 Task 3
 *   gave them `addProductToCategory` / `removeProductFromCategory` /
 *   `setProductCategories` in category.repository.
 * - `assignProductToCategories` (the leaf-VALIDATED bulk replace) is NOT
 *   used here: the admin contract takes the passed ids as authoritative
 *   (the conformance suite assigns to a root that still has children), so
 *   the service routes through the unvalidated `setProductCategories`.
 *
 * Unit discipline: write inputs carry prices as MAJOR-unit numbers (the
 * repo boundary's unit); `toProductDTO` converts to Money (minor units) on
 * the way back out, so round-trips observe the conversion.
 *
 * Message parity: catch blocks reuse the strings today's actions returned
 * (fixed strings for the admin-products/admin-orders families, the thrown
 * repo message for the category/promo/hero/color families whose actions
 * surfaced `error.message`). Repo `null`/`false`/typed-result failures map
 * to NOT_FOUND / CONFLICT / VALIDATION with the action's specific message.
 */
export function createAdminCatalogService(
  config: EngineConfig,
  _tenant: TenantRef,
  _actor?: v1.ActorRef
): v1.AdminCatalogService {
  const currency = config.defaultCurrency ?? 'LKR'
  const db = config.neo4j.database

  async function withSession<T>(fn: (session: Session) => Promise<T>): Promise<T> {
    const session = getSession(db)
    try {
      return await fn(session)
    } finally {
      await session.close()
    }
  }

  /**
   * Parity with the category/promo/hero/color actions, which surfaced the
   * thrown error's own message (`error.message : '…fallback'`) rather than a
   * fixed string.
   */
  const repoMessage = (e: unknown, fallback: string): string =>
    e instanceof Error && e.message ? e.message : fallback

  /** Repo-thrown 'X not found' → NOT_FOUND with the same message. */
  const notFound = (e: unknown, message: string): boolean =>
    e instanceof Error && e.message === message

  return {
    // -----------------------------------------------------------------
    // Products
    // -----------------------------------------------------------------
    async createProduct(actor, input) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const created = await productRepo.createProduct(
          {
            name: input.name,
            description: input.description,
            brand: input.brand,
            gender: input.gender,
            stockPrice: input.stockPrice,
            retailPrice: input.retailPrice,
            sku: input.sku,
            images: input.images,
          },
          // Variant images are dead post-Phase-1 (product-level images only);
          // the repo's legacy column is written as the empty array, exactly
          // what createProductAction's variantsToCreate carried.
          input.variants.map((variant) => ({ ...variant, images: [] })),
          db
        )
        return ok(toProductDTO(created, currency))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to create product', { cause: String(e) })
      }
    },

    async updateProduct(actor, id, input) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        await productRepo.updateProduct(id, input, db)
        // Repo returns the product WITHOUT variants; re-fetch so the DTO
        // reflects what was actually written (same pattern as order service).
        const full = await productRepo.getProductById(id, db)
        if (!full) return err('NOT_FOUND', `Product ${id} not found`)
        return ok(toProductDTO(full, currency))
      } catch (e) {
        if (notFound(e, 'Product not found')) return err('NOT_FOUND', 'Product not found')
        return err('UNAVAILABLE', 'Failed to update product', { cause: String(e) })
      }
    },

    async deleteProduct(actor, id) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        await productRepo.deleteProduct(id, db)
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to delete product', { cause: String(e) })
      }
    },

    async addVariant(actor, productId, input) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        await productRepo.addVariant(
          productId,
          { ...input, images: [] },
          db
        )
        const full = await productRepo.getProductById(productId, db)
        if (!full) return err('NOT_FOUND', `Product ${productId} not found`)
        return ok(toProductDTO(full, currency))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to add variant', { cause: String(e) })
      }
    },

    async updateVariant(actor, variantId, input) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const variant = await productRepo.updateVariant(variantId, input, db)
        const full = await productRepo.getProductById(variant.productId, db)
        if (!full) return err('NOT_FOUND', `Product ${variant.productId} not found`)
        return ok(toProductDTO(full, currency))
      } catch (e) {
        if (notFound(e, 'Variant not found')) return err('NOT_FOUND', 'Variant not found')
        return err('UNAVAILABLE', 'Failed to update variant', { cause: String(e) })
      }
    },

    async addProductImage(actor, productId, imageUrl) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        await productRepo.addProductImage(productId, imageUrl, db)
        const full = await productRepo.getProductById(productId, db)
        if (!full) return err('NOT_FOUND', `Product ${productId} not found`)
        return ok(toProductDTO(full, currency))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to add image to product', { cause: String(e) })
      }
    },

    async removeProductImage(actor, productId, imageUrl) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        await productRepo.removeProductImage(productId, imageUrl, db)
        const full = await productRepo.getProductById(productId, db)
        if (!full) return err('NOT_FOUND', `Product ${productId} not found`)
        return ok(toProductDTO(full, currency))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to remove image from product', { cause: String(e) })
      }
    },

    async searchProductsByName(actor, term) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        // Same read the action used: CONTAINS search capped at 10.
        const products = await productRepo.getAllProducts({ search: term }, 10, db)
        return ok(products.map((p) => toProductDTO(p, currency)))
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to search products', { cause: String(e) })
      }
    },

    async checkProductNameExists(actor, name, excludeId) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const products = await productRepo.getAllProducts({ search: name }, 10, db)
        const exists = products.some(
          (p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== excludeId
        )
        return ok(exists)
      } catch (e) {
        return err('UNAVAILABLE', 'Failed to check product name', { cause: String(e) })
      }
    },

    // -----------------------------------------------------------------
    // Categories
    // -----------------------------------------------------------------
    async createCategory(actor, input) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const c = await withSession((session) =>
          categoryRepo.createCategory(
            session,
            input.name,
            input.hierarchy,
            input.parentId ?? null,
            input.isFeatured ?? false
          )
        )
        return ok(toCategoryDTO(c))
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to create category'))
      }
    },

    async updateCategory(actor, id, input) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const c = await withSession((session) => categoryRepo.updateCategory(session, id, input))
        return ok(toCategoryDTO(c))
      } catch (e) {
        if (notFound(e, 'Category not found')) return err('NOT_FOUND', 'Category not found')
        return err('UNAVAILABLE', repoMessage(e, 'Failed to update category'))
      }
    },

    async deleteCategory(actor, id) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const r = await withSession((session) => categoryRepo.deleteCategory(session, id))
        if (!r.success) {
          // Repo returns the action's exact strings ('Category not found',
          // 'Cannot delete "X" because it has N child categories/products…')
          return r.message === 'Category not found'
            ? err('NOT_FOUND', 'Category not found')
            : err('CONFLICT', r.message ?? 'Failed to delete category')
        }
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to delete category'))
      }
    },

    async moveCategory(actor, id, newParentId) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const c = await withSession((session) =>
          categoryRepo.moveCategory(session, id, newParentId)
        )
        return ok(toCategoryDTO(c))
      } catch (e) {
        if (e instanceof Error && e.message.endsWith('not found')) {
          return err('NOT_FOUND', e.message)
        }
        return err('UNAVAILABLE', repoMessage(e, 'Failed to move category'))
      }
    },

    async assignProductToCategory(actor, productId, categoryId) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        return await withSession(async (session) => {
          // Checks the action performed inline, with its exact messages:
          // leaf validation, then duplicate-assignment rejection.
          const validation = await categoryRepo.validateLeafCategoryForProduct(
            session,
            categoryId
          )
          if (!validation.valid) {
            return err('VALIDATION', validation.error ?? 'Category cannot accept products')
          }
          const existing = await categoryRepo.getCategoriesForProduct(session, productId)
          if (existing.includes(categoryId)) {
            return err('VALIDATION', 'Product is already assigned to this category')
          }
          await categoryRepo.addProductToCategory(session, productId, categoryId)
          return ok(null)
        })
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Operation failed'))
      }
    },

    async assignProductToCategories(actor, productId, categoryIds) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        await withSession((session) =>
          categoryRepo.setProductCategories(session, productId, categoryIds)
        )
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Operation failed'))
      }
    },

    async removeProductFromCategory(actor, productId, categoryId) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        await withSession((session) =>
          categoryRepo.removeProductFromCategory(session, productId, categoryId)
        )
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Operation failed'))
      }
    },

    // -----------------------------------------------------------------
    // Promotional categories
    // -----------------------------------------------------------------
    async createPromotionalCategory(actor, input) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const c = await withSession((session) =>
          promoRepo.createPromotionalCategory(session, input)
        )
        return ok(toPromotionalCategoryDTO(c))
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to create promotional category'))
      }
    },

    async updatePromotionalCategory(actor, id, input) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const c = await withSession((session) =>
          promoRepo.updatePromotionalCategory(session, id, input)
        )
        if (!c) return err('NOT_FOUND', 'Promotional category not found')
        return ok(toPromotionalCategoryDTO(c))
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to update promotional category'))
      }
    },

    async deletePromotionalCategory(actor, id) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const deleted = await withSession((session) =>
          promoRepo.deletePromotionalCategory(session, id)
        )
        if (!deleted) return err('NOT_FOUND', 'Promotional category not found')
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to delete promotional category'))
      }
    },

    async addProductToPromotionalCategory(actor, categoryId, productId, allocatedQuantity) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        await withSession((session) =>
          promoRepo.addProductToCategory(session, categoryId, productId, allocatedQuantity)
        )
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to add product to category'))
      }
    },

    async removeProductFromPromotionalCategory(actor, categoryId, productId) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const removed = await withSession((session) =>
          promoRepo.removeProductFromCategory(session, categoryId, productId)
        )
        if (!removed) return err('NOT_FOUND', 'Product not found in category')
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to remove product from category'))
      }
    },

    async setPromotionalCategoryQuantity(actor, categoryId, productId, allocatedQuantity) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const item = await withSession((session) =>
          promoRepo.updateCategoryItemQuantity(
            session,
            categoryId,
            productId,
            allocatedQuantity
          )
        )
        if (!item) return err('NOT_FOUND', 'Product not found in category')
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to update quantity'))
      }
    },

    async toggleProductInPromotionalCategory(actor, categoryId, productId, isActive) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const updated = await withSession((session) =>
          promoRepo.toggleProductInCategory(session, categoryId, productId, isActive)
        )
        if (!updated) return err('NOT_FOUND', 'Product not found in category')
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to toggle product visibility'))
      }
    },

    async moveQuantity(actor, productId, fromCategoryId, toCategoryId, quantity) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const moved = await withSession((session) =>
          promoRepo.moveQuantityBetweenCategories(
            session,
            productId,
            fromCategoryId,
            toCategoryId,
            quantity
          )
        )
        if (!moved) {
          // The repo's false means the WHERE clause (remaining allocated
          // quantity >= requested) did not match — a state conflict, with
          // the action's exact message.
          return err(
            'CONFLICT',
            'Failed to move quantity. Check if sufficient quantity is available.'
          )
        }
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to move quantity'))
      }
    },

    // -----------------------------------------------------------------
    // Hero slides
    // -----------------------------------------------------------------
    async createHeroSlide(actor, input) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const s = await withSession((session) => heroRepo.createHeroSlide(session, input))
        return ok(toHeroSlideDTO(s))
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to create hero slide'))
      }
    },

    async updateHeroSlide(actor, id, input) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const s = await withSession((session) => heroRepo.updateHeroSlide(session, id, input))
        // Null covers both not-found and an empty update set; the repo cannot
        // distinguish them and the action reported 'Hero slide not found'.
        if (!s) return err('NOT_FOUND', 'Hero slide not found')
        return ok(toHeroSlideDTO(s))
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to update hero slide'))
      }
    },

    async deleteHeroSlide(actor, id) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const deleted = await withSession((session) => heroRepo.deleteHeroSlide(session, id))
        if (!deleted) return err('NOT_FOUND', 'Hero slide not found')
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to delete hero slide'))
      }
    },

    async reorderHeroSlides(actor, slides) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        await withSession((session) => heroRepo.reorderHeroSlides(session, slides))
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to reorder hero slides'))
      }
    },

    // -----------------------------------------------------------------
    // Colors
    // -----------------------------------------------------------------
    async listColors(actor) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const colors = await withSession((session) => colorRepo.getAllColors(session))
        return ok(colors.map(toColorDTO))
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to fetch colors'))
      }
    },

    async createColor(actor, name, hex) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      // Same pre-repo checks (and messages) as createColorAction.
      if (!name || !name.trim()) return err('VALIDATION', 'Color name is required')
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
        return err('VALIDATION', 'Invalid hex color (must be #RRGGBB)')
      }
      try {
        const c = await withSession((session) =>
          colorRepo.createColor(session, { name: name.trim(), hex })
        )
        return ok(toColorDTO(c))
      } catch (e) {
        const msg = repoMessage(e, 'Failed to create color')
        if (msg.includes('already exists')) {
          return err('UNAVAILABLE', 'A color with that name already exists')
        }
        return err('UNAVAILABLE', msg)
      }
    },

    async toggleColorActive(actor, id) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const c = await withSession((session) => colorRepo.toggleColorActive(session, id))
        if (!c) return err('NOT_FOUND', 'Color not found')
        return ok(toColorDTO(c))
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to toggle color'))
      }
    },

    async deleteColor(actor, id) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const deleted = await withSession((session) => colorRepo.deleteColor(session, id))
        if (!deleted) return err('NOT_FOUND', 'Color not found')
        return ok(null)
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to delete color'))
      }
    },

    async colorCount(actor) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        return ok(await withSession((session) => colorRepo.getColorCount(session)))
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to get color count'))
      }
    },

    async seedColors(actor, colors) {
      if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')
      try {
        const count = await withSession((session) =>
          colorRepo.seedDefaultColors(session, colors)
        )
        if (count === 0) {
          // Action parity: seeding over a non-empty palette reported
          // 'Colors already exist in the database' as a failure.
          return err('CONFLICT', 'Colors already exist in the database')
        }
        return ok(count)
      } catch (e) {
        return err('UNAVAILABLE', repoMessage(e, 'Failed to seed colors'))
      }
    },
  }
}
