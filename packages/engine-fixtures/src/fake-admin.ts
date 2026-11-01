// Fake AdminCatalogService + AdminOrderService v1 (Phase 5 Task 4) —
// in-memory admin writes over the SHARED fake catalog state
// (createFakeCatalogState) and the SHARED fake order state
// (createFakeOrderState), so admin CRUD mutates the SAME lists the
// storefront services read. The fake cannot import engine code, so every
// engine-owned guard/string/rule below is DUPLICATED with a parity comment —
// keep them in lockstep with packages/engine/src/admin-catalog.ts +
// admin-order.ts (themselves ports of the repo/action semantics).
//
// `v1` (ok/err/money helpers) comes from the contract root; the world
// currency comes from the `@softx/contract/testing` subpath.
import { v1 } from '@softx/contract'
import { worldCurrency } from '@softx/contract/testing'
import type { FakeCatalogState, FakePromoItem } from './fake-catalog'
import { toOrderDTO, type FakeOrderState } from './fake-order'

const { ok, err } = v1

// ---------------------------------------------------------------------------
// Parity strings/rules — duplicated from packages/engine/src/admin-catalog.ts
// + admin-order.ts (which carry the action/repo messages verbatim).
// ---------------------------------------------------------------------------

/** parity with admin-catalog/admin-order — every admin method's guard message */
const ADMIN_REQUIRED_MESSAGE = 'Admin access required'
/** parity with category.repository createCategory's slug generation */
const slugify = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
/** parity with the repositories' 'N child categories' / 'N products' wording */
const childCategoriesPhrase = (n: number): string => `${n} child ${n === 1 ? 'category' : 'categories'}`
const productsPhrase = (n: number): string => `${n} ${n === 1 ? 'product' : 'products'}`

/**
 * The per-call actor guard, FIRST in every method (engine discipline): a
 * non-admin actor answers UNAUTHORIZED ('Admin access required') BEFORE any
 * state work — never NOT_FOUND, never a mutation.
 */
function denyNonAdmin(actor: v1.ActorRef | undefined): v1.Result<never> | null {
  return actor?.kind === 'admin' ? null : err('UNAUTHORIZED', ADMIN_REQUIRED_MESSAGE)
}

/**
 * Fake admin services. `actor` mirrors the engine's `engine.for(tenant,
 * actor)` binding and is deliberately NOT consulted — the per-call ActorRef
 * is always authoritative (the gating blocks pass anonymous/customer actors
 * against a service built with an admin actor bound, exactly as the engine
 * behaves).
 */
export function createFakeAdminServices(
  catalogState: FakeCatalogState,
  orderState: FakeOrderState,
  _actor?: v1.ActorRef,
): { adminCatalog: v1.AdminCatalogService; adminOrder: v1.AdminOrderService } {
  const { products, categories, promos, slides, colors, productCategories, promoItems } =
    catalogState
  const { orders } = orderState

  const now = (): string => new Date().toISOString()
  const promoKey = (categoryId: string, productId: string): string => `${categoryId}:${productId}`

  const findProduct = (id: string) => products.find((p) => p.id === id)
  const findVariantHolder = (variantId: string) =>
    products.find((p) => p.variants.some((v) => v.id === variantId))
  const findCategory = (id: string) => categories.find((c) => c.id === id)
  const findPromo = (id: string) => promos.find((c) => c.id === id)
  const findSlide = (id: string) => slides.find((s) => s.id === id)
  const findColor = (id: string) => colors.find((c) => c.id === id)

  /** Child count by parentId — the repo's CHILD_OF degree. */
  const childCount = (categoryId: string): number =>
    categories.filter((c) => c.parentId === categoryId).length

  /** Assigned-product count — the repo's HAS_CATEGORY degree. */
  const assignedProductCount = (categoryId: string): number =>
    [...productCategories.values()].filter((set) => set.has(categoryId)).length

  /**
   * The read the engine's searchProductsByName/checkProductNameExists use:
   * product.repository.getAllProducts({search}, 10) — case-insensitive
   * name-or-brand CONTAINS, createdAt DESC, capped at 10.
   */
  const searchProductsCapped = (term: string): v1.ProductDTO[] =>
    products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term.toLowerCase()) ||
          p.brand.toLowerCase().includes(term.toLowerCase()),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10)

  /** Recalculate a category's descendant levels after a move (repo parity). */
  const recalculateDescendantLevels = (categoryId: string): void => {
    for (const child of categories.filter((c) => c.parentId === categoryId)) {
      const parent = findCategory(categoryId)
      child.level = (parent?.level ?? 0) + 1
      child.updatedAt = now()
      recalculateDescendantLevels(child.id)
    }
  }

  const adminCatalog: v1.AdminCatalogService = {
    // -----------------------------------------------------------------
    // Products
    // -----------------------------------------------------------------
    async createProduct(actor, input) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      // Repo guard parity (the contract's zod already blocks these; the
      // causes mirror the repo throws the engine wraps as UNAVAILABLE).
      if (input.variants.length === 0) {
        return err('UNAVAILABLE', 'Failed to create product', { cause: 'At least one variant is required' })
      }
      if (input.stockPrice <= 0) {
        return err('UNAVAILABLE', 'Failed to create product', { cause: 'Stock price must be greater than 0' })
      }
      if (input.retailPrice <= 0) {
        return err('UNAVAILABLE', 'Failed to create product', { cause: 'Retail price must be greater than 0' })
      }
      // parity with product.repository.createProduct: uuid ids, now stamps;
      // major-unit write prices surface as Money (minor) on the DTO — the
      // engine's toProductDTO/fromMajorAmount conversion observed by the suite.
      const ts = now()
      const product: v1.ProductDTO = {
        id: crypto.randomUUID(),
        name: input.name,
        description: input.description,
        brand: input.brand,
        gender: input.gender,
        sku: input.sku,
        price: {
          stock: v1.fromMajorAmount(input.stockPrice, worldCurrency),
          retail: v1.fromMajorAmount(input.retailPrice, worldCurrency),
        },
        images: [...input.images],
        createdAt: ts,
        updatedAt: ts,
        // Variant images are dead post-Phase-1 — nothing to store.
        variants: input.variants.map((variant) => ({ id: crypto.randomUUID(), ...variant })),
      }
      products.push(product)
      return ok(product)
    },

    async updateProduct(actor, id, input) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const product = findProduct(id)
      // parity with the engine's repo-throw mapping ('Product not found')
      if (!product) return err('NOT_FOUND', 'Product not found')
      if (input.name !== undefined) product.name = input.name
      if (input.description !== undefined) product.description = input.description
      if (input.brand !== undefined) product.brand = input.brand
      if (input.gender !== undefined) product.gender = input.gender
      if (input.sku !== undefined) product.sku = input.sku
      if (input.images !== undefined) product.images = [...input.images]
      // Major-unit write prices → Money, same conversion as create.
      if (input.stockPrice !== undefined) {
        product.price.stock = v1.fromMajorAmount(input.stockPrice, worldCurrency)
      }
      if (input.retailPrice !== undefined) {
        product.price.retail = v1.fromMajorAmount(input.retailPrice, worldCurrency)
      }
      product.updatedAt = now()
      // Re-fetch-equivalent: the engine re-reads the full row (variants
      // included) after the write; the stored object IS that read.
      return ok(product)
    },

    async deleteProduct(actor, id) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      // parity with product.repository.deleteProduct: a missing id matches
      // nothing and errors nothing — ok(null).
      const idx = products.findIndex((p) => p.id === id)
      if (idx !== -1) products.splice(idx, 1)
      return ok(null)
    },

    async addVariant(actor, productId, input) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const product = findProduct(productId)
      // parity with the engine's re-fetch-null path after the repo write
      if (!product) return err('NOT_FOUND', `Product ${productId} not found`)
      product.variants.push({ id: crypto.randomUUID(), ...input })
      return ok(product)
    },

    async updateVariant(actor, variantId, input) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const product = findVariantHolder(variantId)
      if (!product) return err('NOT_FOUND', 'Variant not found')
      const variant = product.variants.find((v) => v.id === variantId)!
      if (input.size !== undefined) variant.size = input.size
      if (input.color !== undefined) variant.color = input.color
      if (input.stockQuantity !== undefined) variant.stockQuantity = input.stockQuantity
      return ok(product)
    },

    async addProductImage(actor, productId, imageUrl) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const product = findProduct(productId)
      if (!product) return err('NOT_FOUND', `Product ${productId} not found`)
      // parity with the repo's `p.images + $imageUrl` Cypher append
      if (!product.images.includes(imageUrl)) product.images.push(imageUrl)
      product.updatedAt = now()
      return ok(product)
    },

    async removeProductImage(actor, productId, imageUrl) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const product = findProduct(productId)
      if (!product) return err('NOT_FOUND', `Product ${productId} not found`)
      product.images = product.images.filter((img) => img !== imageUrl)
      product.updatedAt = now()
      return ok(product)
    },

    async searchProductsByName(actor, term) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      return ok(searchProductsCapped(term))
    },

    async checkProductNameExists(actor, name, excludeId) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      // parity with the engine: exact case-insensitive name match over the
      // capped CONTAINS search, minus the excluded product itself.
      const exists = searchProductsCapped(name).some(
        (p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== excludeId,
      )
      return ok(exists)
    },

    // -----------------------------------------------------------------
    // Categories
    // -----------------------------------------------------------------
    async createCategory(actor, input) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      let level = 0
      if (input.parentId != null) {
        const parent = findCategory(input.parentId)
        // parity with category.repository.createCategory's throw (engine maps
        // the repo message onto UNAVAILABLE)
        if (!parent) return err('UNAVAILABLE', 'Parent category not found')
        level = parent.level + 1
      }
      const ts = now()
      const category: v1.CategoryDTO = {
        id: crypto.randomUUID(),
        name: input.name,
        slug: slugify(input.name), // generated repo-side — not unique
        hierarchy: input.hierarchy,
        parentId: input.parentId ?? null,
        level,
        isActive: true, // repo default
        isFeatured: input.isFeatured ?? false, // repo default
        createdAt: ts,
        updatedAt: ts,
      }
      categories.push(category)
      return ok(category)
    },

    async updateCategory(actor, id, input) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const category = findCategory(id)
      if (!category) return err('NOT_FOUND', 'Category not found')
      // parity with category.repository.updateCategory: a name change also
      // regenerates the slug.
      if (input.name !== undefined) {
        category.name = input.name
        category.slug = slugify(input.name)
      }
      if (input.isActive !== undefined) category.isActive = input.isActive
      if (input.isFeatured !== undefined) category.isFeatured = input.isFeatured
      category.updatedAt = now()
      return ok(category)
    },

    async deleteCategory(actor, id) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const category = findCategory(id)
      if (!category) return err('NOT_FOUND', 'Category not found')
      // parity with category.repository.deleteCategory's guarded failure
      // strings (children check first, then assigned products).
      const children = childCount(id)
      if (children > 0) {
        return err(
          'CONFLICT',
          `Cannot delete "${category.name}" because it has ${childCategoriesPhrase(children)}. Please delete the child categories first.`,
        )
      }
      const assigned = assignedProductCount(id)
      if (assigned > 0) {
        return err(
          'CONFLICT',
          `Cannot delete "${category.name}" because it has ${productsPhrase(assigned)} assigned. Please remove or reassign the products first.`,
        )
      }
      categories.splice(categories.indexOf(category), 1)
      // DETACH DELETE parity: memberships referencing the category go too.
      for (const set of productCategories.values()) set.delete(id)
      return ok(null)
    },

    async moveCategory(actor, id, newParentId) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const category = findCategory(id)
      if (!category) return err('NOT_FOUND', `Category ${id} not found`)
      if (newParentId != null) {
        const parent = findCategory(newParentId)
        // parity with category.repository.moveCategory's '… not found' throw
        // (the engine maps trailing-'not found' messages onto NOT_FOUND)
        if (!parent) return err('NOT_FOUND', 'New parent category not found')
        // Walk the parent chain from the target: reaching ourselves means the
        // target is our own descendant (repo's CHILD_OF*1.. path check).
        let cursor: v1.CategoryDTO | undefined = parent
        while (cursor) {
          if (cursor.id === id) {
            return err('UNAVAILABLE', 'Cannot move category to its own descendant')
          }
          cursor = cursor.parentId === null ? undefined : findCategory(cursor.parentId)
        }
        category.level = parent.level + 1
      } else {
        category.level = 0
      }
      category.parentId = newParentId
      category.updatedAt = now()
      recalculateDescendantLevels(id)
      return ok(category)
    },

    async assignProductToCategory(actor, productId, categoryId) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      // parity with the inline checks the engine performs (leaf validation,
      // then duplicate-assignment rejection) with the action's messages.
      const category = findCategory(categoryId)
      if (!category) {
        return err('VALIDATION', `Category with ID ${categoryId} not found`)
      }
      const children = childCount(categoryId)
      if (children > 0) {
        return err(
          'VALIDATION',
          `Cannot assign products to parent category "${category.name}". This category has ${childCategoriesPhrase(children)}. Please assign to a leaf category (one without children).`,
        )
      }
      const existing = productCategories.get(productId) ?? new Set<string>()
      if (existing.has(categoryId)) {
        return err('VALIDATION', 'Product is already assigned to this category')
      }
      existing.add(categoryId)
      productCategories.set(productId, existing)
      return ok(null)
    },

    async assignProductToCategories(actor, productId, categoryIds) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      // parity with category.repository.setProductCategories: the unvalidated
      // bulk REPLACE — passed ids are authoritative (parents allowed).
      productCategories.set(productId, new Set(categoryIds))
      return ok(null)
    },

    async removeProductFromCategory(actor, productId, categoryId) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      // parity with category.repository.removeProductFromCategory: no-op when
      // the relationship does not exist.
      productCategories.get(productId)?.delete(categoryId)
      return ok(null)
    },

    // -----------------------------------------------------------------
    // Promotional categories
    // -----------------------------------------------------------------
    async createPromotionalCategory(actor, input) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const ts = now()
      const promo: v1.PromotionalCategoryDTO = {
        id: crypto.randomUUID(),
        name: input.name,
        slug: input.slug,
        // parity with the repo's `description || null` write + the mapper's
        // falsy-omit: absent/empty stays absent on the DTO.
        ...(input.description ? { description: input.description } : {}),
        displayOrder: input.displayOrder,
        isActive: input.isActive ?? true, // repo default
        ...(input.startDate ? { startDate: input.startDate } : {}),
        ...(input.endDate ? { endDate: input.endDate } : {}),
        createdAt: ts,
        updatedAt: ts,
      }
      promos.push(promo)
      return ok(promo)
    },

    async updatePromotionalCategory(actor, id, input) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const promo = findPromo(id)
      if (!promo) return err('NOT_FOUND', 'Promotional category not found')
      const hasUpdates = Object.values(input).some((value) => value !== undefined)
      // parity with the repo: an empty update SET matches nothing → null →
      // the engine's NOT_FOUND.
      if (!hasUpdates) return err('NOT_FOUND', 'Promotional category not found')
      if (input.name !== undefined) promo.name = input.name
      if (input.slug !== undefined) promo.slug = input.slug
      if (input.description !== undefined) promo.description = input.description || undefined
      if (input.displayOrder !== undefined) promo.displayOrder = input.displayOrder
      if (input.isActive !== undefined) promo.isActive = input.isActive
      if (input.startDate !== undefined) promo.startDate = input.startDate || undefined
      if (input.endDate !== undefined) promo.endDate = input.endDate || undefined
      promo.updatedAt = now()
      return ok(promo)
    },

    async deletePromotionalCategory(actor, id) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const promo = findPromo(id)
      if (!promo) return err('NOT_FOUND', 'Promotional category not found')
      promos.splice(promos.indexOf(promo), 1)
      // The repo's `OPTIONAL MATCH (c)-[r:HAS_ITEM]->() DELETE r` detaches
      // the membership rows with the node.
      for (const key of [...promoItems.keys()]) {
        if (key.startsWith(`${id}:`)) promoItems.delete(key)
      }
      return ok(null)
    },

    async addProductToPromotionalCategory(actor, categoryId, productId, allocatedQuantity) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      // parity with the repo's double MATCH + MERGE: a missing category or
      // product makes the Cypher fail (the engine wraps it as UNAVAILABLE).
      if (!findPromo(categoryId) || !findProduct(productId)) {
        return err('UNAVAILABLE', 'Failed to add product to category', {
          cause: 'MERGE matched no rows',
        })
      }
      const key = promoKey(categoryId, productId)
      const existing = promoItems.get(key)
      if (existing) {
        // ON MATCH SET: allocation replaced, sold/isActive untouched.
        existing.allocatedQuantity = allocatedQuantity
      } else {
        const item: FakePromoItem = {
          categoryId,
          productId,
          allocatedQuantity,
          soldQuantity: 0,
          isActive: true,
        }
        promoItems.set(key, item)
      }
      return ok(null)
    },

    async removeProductFromPromotionalCategory(actor, categoryId, productId) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      if (!promoItems.delete(promoKey(categoryId, productId))) {
        return err('NOT_FOUND', 'Product not found in category')
      }
      return ok(null)
    },

    async setPromotionalCategoryQuantity(actor, categoryId, productId, allocatedQuantity) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const item = promoItems.get(promoKey(categoryId, productId))
      if (!item) return err('NOT_FOUND', 'Product not found in category')
      item.allocatedQuantity = allocatedQuantity
      return ok(null)
    },

    async toggleProductInPromotionalCategory(actor, categoryId, productId, isActive) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const item = promoItems.get(promoKey(categoryId, productId))
      if (!item) return err('NOT_FOUND', 'Product not found in category')
      item.isActive = isActive
      return ok(null)
    },

    async moveQuantity(actor, productId, fromCategoryId, toCategoryId, quantity) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const from = promoItems.get(promoKey(fromCategoryId, productId))
      // parity with the repo's WHERE clause (remaining >= requested): a miss
      // is a state conflict with the action's exact message.
      if (!from || from.allocatedQuantity - from.soldQuantity < quantity) {
        return err('CONFLICT', 'Failed to move quantity. Check if sufficient quantity is available.')
      }
      from.allocatedQuantity -= quantity
      const toKey = promoKey(toCategoryId, productId)
      const to = promoItems.get(toKey)
      if (to) {
        to.allocatedQuantity += quantity // ON MATCH SET
      } else {
        promoItems.set(toKey, {
          categoryId: toCategoryId,
          productId,
          allocatedQuantity: quantity,
          soldQuantity: 0,
          isActive: true,
        })
      }
      return ok(null)
    },

    // -----------------------------------------------------------------
    // Hero slides
    // -----------------------------------------------------------------
    async createHeroSlide(actor, input) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      // parity with hero-slide.repository.createHeroSlide: optionals are
      // written as null and read back undefined (the mapper omits falsy);
      // colorTheme/isActive default.
      const slide: v1.HeroSlideDTO = {
        id: crypto.randomUUID(),
        imageUrl: input.imageUrl,
        ...(input.mobileImageUrl ? { mobileImageUrl: input.mobileImageUrl } : {}),
        animationType: input.animationType,
        ...(input.mobileAnimationType ? { mobileAnimationType: input.mobileAnimationType } : {}),
        colorTheme: input.colorTheme ?? 'light',
        ...(input.mobileColorTheme ? { mobileColorTheme: input.mobileColorTheme } : {}),
        ...(input.customDesktopStyle ? { customDesktopStyle: { ...input.customDesktopStyle } } : {}),
        ...(input.customMobileStyle ? { customMobileStyle: { ...input.customMobileStyle } } : {}),
        badgeText: input.badgeText,
        title: input.title,
        subtitle: input.subtitle,
        ...(input.linkUrl ? { linkUrl: input.linkUrl } : {}),
        displayOrder: input.displayOrder,
        isActive: input.isActive ?? true,
      }
      slides.push(slide)
      return ok(slide)
    },

    async updateHeroSlide(actor, id, input) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const slide = findSlide(id)
      // parity with the engine: null covers both not-found and an empty
      // update set (the repo cannot distinguish them).
      if (!slide) return err('NOT_FOUND', 'Hero slide not found')
      const hasUpdates = Object.values(input).some((value) => value !== undefined)
      if (!hasUpdates) return err('NOT_FOUND', 'Hero slide not found')
      if (input.imageUrl !== undefined) slide.imageUrl = input.imageUrl
      // Null-CLEARING discipline (HeroSlideUpdateInput): null → the field is
      // cleared — deleted from the stored slide so the DTO omits it
      // (undefined), never lingers as null.
      if (input.mobileImageUrl !== undefined) {
        if (input.mobileImageUrl === null) delete slide.mobileImageUrl
        else slide.mobileImageUrl = input.mobileImageUrl
      }
      if (input.animationType !== undefined) slide.animationType = input.animationType
      if (input.mobileAnimationType !== undefined) {
        if (input.mobileAnimationType === null) delete slide.mobileAnimationType
        else slide.mobileAnimationType = input.mobileAnimationType
      }
      if (input.colorTheme !== undefined) slide.colorTheme = input.colorTheme
      if (input.mobileColorTheme !== undefined) {
        if (input.mobileColorTheme === null) delete slide.mobileColorTheme
        else slide.mobileColorTheme = input.mobileColorTheme
      }
      if (input.customDesktopStyle !== undefined) {
        if (input.customDesktopStyle === null) delete slide.customDesktopStyle
        else slide.customDesktopStyle = { ...input.customDesktopStyle }
      }
      if (input.customMobileStyle !== undefined) {
        if (input.customMobileStyle === null) delete slide.customMobileStyle
        else slide.customMobileStyle = { ...input.customMobileStyle }
      }
      if (input.badgeText !== undefined) slide.badgeText = input.badgeText
      if (input.title !== undefined) slide.title = input.title
      if (input.subtitle !== undefined) slide.subtitle = input.subtitle
      if (input.linkUrl !== undefined) {
        if (input.linkUrl === null) delete slide.linkUrl
        else slide.linkUrl = input.linkUrl
      }
      if (input.displayOrder !== undefined) slide.displayOrder = input.displayOrder
      if (input.isActive !== undefined) slide.isActive = input.isActive
      return ok(slide)
    },

    async deleteHeroSlide(actor, id) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const slide = findSlide(id)
      if (!slide) return err('NOT_FOUND', 'Hero slide not found')
      slides.splice(slides.indexOf(slide), 1)
      return ok(null)
    },

    async reorderHeroSlides(actor, slideOrder) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      // parity with the repo: per-slide SETs; unknown ids match nothing and
      // never fail.
      for (const { id, displayOrder } of slideOrder) {
        const slide = findSlide(id)
        if (slide) slide.displayOrder = displayOrder
      }
      return ok(null)
    },

    // -----------------------------------------------------------------
    // Colors
    // -----------------------------------------------------------------
    async listColors(actor) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      // parity with colorRepo.getAllColors: ORDER BY c.name.
      return ok(colors.slice().sort((a, b) => a.name.localeCompare(b.name)))
    },

    async createColor(actor, name, hex) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      // parity with createColorAction's pre-repo checks + messages.
      if (!name || !name.trim()) return err('VALIDATION', 'Color name is required')
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
        return err('VALIDATION', 'Invalid hex color (must be #RRGGBB)')
      }
      // parity with colorRepo.createColor: trimmed name + hex are lowercased.
      const color: v1.ColorDTO = {
        id: crypto.randomUUID(),
        name: name.trim().toLowerCase(),
        hex: hex.toLowerCase(),
        isActive: true,
        createdAt: now(),
      }
      colors.push(color)
      return ok(color)
    },

    async toggleColorActive(actor, id) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const color = findColor(id)
      if (!color) return err('NOT_FOUND', 'Color not found')
      color.isActive = !color.isActive
      return ok(color)
    },

    async deleteColor(actor, id) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const color = findColor(id)
      if (!color) return err('NOT_FOUND', 'Color not found')
      colors.splice(colors.indexOf(color), 1)
      return ok(null)
    },

    async colorCount(actor) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      return ok(colors.length)
    },

    async seedColors(actor, seed) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      // parity with colorRepo.seedDefaultColors: 0 when any color exists.
      if (colors.length > 0) return err('CONFLICT', 'Colors already exist in the database')
      const ts = now()
      for (const { name, hex } of seed) {
        colors.push({ id: crypto.randomUUID(), name: name.toLowerCase(), hex: hex.toLowerCase(), isActive: true, createdAt: ts })
      }
      return ok(seed.length)
    },
  }

  const adminOrder: v1.AdminOrderService = {
    async listAllOrders(actor) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      // parity with orderRepo.getAllOrders: every order INCLUDING items,
      // newest first (createdAt DESC; fixed timestamps → reverse insertion).
      return ok(
        orders
          .slice()
          .reverse()
          .map(toOrderDTO),
      )
    },

    async updateOrderStatus(actor, orderId, status) {
      const denied = denyNonAdmin(actor)
      if (denied) return denied
      const order = orders.find((o) => o.id === orderId)
      // parity with the engine: the repo dereferences its empty result set on
      // a missing id, surfacing as the action's UNAVAILABLE string.
      if (!order) {
        return err('UNAVAILABLE', 'Failed to update order status', { cause: 'Order not found' })
      }
      order.status = status
      order.updatedAt = now()
      return ok(null)
    },
  }

  return { adminCatalog, adminOrder }
}
