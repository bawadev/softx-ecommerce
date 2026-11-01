# Engine/Contract Separation — Phase 5 (Admin + Actor + Collapse) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the admin write paths behind `AdminCatalogService` + `AdminOrderService`, introduce the `ActorRef` context (anonymous/customer/admin) with admin authorization enforced engine-side, and collapse the migration scaffolding (flat re-exports, dead exports, adapter remnants) plus the accumulated P2–P4 deferral fixes.

**Architecture:** The design's service-contract pattern at its final storefront scope: every admin write the UI performs becomes a contract method returning `Result`, with the actor check INSIDE the engine (actions pass the actor from the session). Cleanup is safe only AFTER all app imports go through services — hence it lands last. Spec §8 Phase 5 + the ledger's deferral pile.

**Tech Stack:** unchanged. No new dependencies (app LOSES bcryptjs in cleanup).

## Global Constraints

- Branch `engine-contract-separation` (== master `1901938` lineage). Commit per task; never push (controller pushes after final review).
- Canonical build: `JWT_SECRET=build-time-placeholder NEO4J_PASSWORD=dummy MINIO_ACCESS_KEY=dummy MINIO_SECRET_KEY=dummy MINIO_BUCKET_NAME=product-images MINIO_USE_SSL=false npm run build`.
- Tests now: `npm test` = 77 passed / 34 skipped; integration = `NEO4J_PASSWORD=ecommerce123 npm run test:integration` → 34 (`docker compose up -d neo4j`, NEVER minio).
- Every contract method returns `Result`; codes from the fixed union. Admin methods called without an admin actor → `UNAUTHORIZED` ('Admin access required').
- Action names + envelope keys unchanged; envelopes keep `{success, message?}` / `{success, data}` shapes (write actions' messages preserved verbatim from the current actions).
- Contract additions additive; snapshot regen in-task; gate clean after.
- **`admin.ts` (makeUserAdmin/checkAdminAccess) and `upload.ts` (MinIO) stay app-side** — role assignment is account-domain policy, uploads are transport; both noted for a future phase.
- Actor: `ActorRef = { kind: 'anonymous' } | { kind: 'customer'; userId: string } | { kind: 'admin'; userId: string }` in the contract; `engine.for(tenant, actor?)` gains the optional param (additive); admin services check `actor?.kind === 'admin'` per method.
- Repos are already database-threaded — no repository changes this phase except where a deferral fix requires it.

---

### Task 1: Contract — ActorRef, AdminCatalogService, AdminOrderService, listNewArrivals

**Files:** Create `packages/contract/src/v1/admin/admin.service.ts` (+ `admin/actor.dto.ts`); modify `v1/catalog/catalog.service.ts` (+`listNewArrivals(limit?): Promise<Result<ProductDTO[]>>`), `v1/index.ts`. Test: `admin/actor.dto.test.ts`.

**Interfaces (under `v1`):**
- `ActorRef` (zod discriminated union as above) + test (3 kinds parse; `{kind:'guest'}` fails)
- `AdminCatalogService` — mirror the CURRENT action surface exactly (read each action file first; names below are canonical, adapt signatures to what the actions pass):
  - Products: `createProduct(input: ProductWriteInput): Result<ProductDTO>` · `updateProduct(id, input): Result<ProductDTO>` · `deleteProduct(id): Result<null>` · `addVariant(productId, input: VariantWriteInput): Result<ProductDTO>` · `updateVariant(variantId, input): Result<ProductDTO>` · `addProductImage(productId, url): Result<ProductDTO>` · `removeProductImage(productId, url): Result<ProductDTO>` · `addVariantImage`/`removeVariantImage(variantId, url)` (if the repo still supports them — check whether variant images are dead post-Phase-1; if dead in the DTO world, EXCLUDE both and note it) · `searchProductsByName(term): Result<ProductDTO[]>` · `checkProductNameExists(name, excludeId?): Result<boolean>`
  - `ProductWriteInput`/`VariantWriteInput`: zod objects mirroring the current form payloads (read `admin-product-form.ts` — name/description/brand/gender/stockPrice/retailPrice/sku/images; variant: size/color/stockQuantity)
  - Categories: `createCategory` · `updateCategory` · `deleteCategory` · `moveCategory(id, newParentId|null)` · `assignProductToCategory`/`removeProductFromCategory` (mirror real action args; CategoryWriteInput = {name, slug?, hierarchy?, parentId?, isActive?, isFeatured?})
  - Promotional categories: `createPromotionalCategory` · `updatePromotionalCategory` · `deletePromotionalCategory` · `addProductToPromotionalCategory(productId, categoryId, qty?)` · `removeProductFromPromotionalCategory` · `setPromotionalCategoryQuantity` · `moveQuantity` (mirror args; PromotionalCategoryWriteInput from the current action payload)
  - Hero: `createHeroSlide(input)` · `updateHeroSlide(id, input)` · `deleteHeroSlide(id)` · `reorderHeroSlides(orderedIds: string[])` (HeroSlideWriteInput mirrors HeroSlideDTO minus id/displayOrder where the actions don't take them — verify)
  - Colors: `listColors(): Result<ColorDTO[]>` · `createColor(name, hex)` · `toggleColorActive(id)` · `deleteColor(id)` · `colorCount(): Result<number>` (ColorDTO = {id, name, hex, isActive} — verify against color.repository)
  - EVERY method's FIRST parameter is `actor: ActorRef`
- `AdminOrderService`: `listAllOrders(actor): Result<OrderDTO[]>` · `updateOrderStatus(actor, orderId, status): Result<null>` (verify whether admin needs items on listAllOrders — the admin UI reads raw OrderWithItems today; map to OrderDTO incl. items)
- DTO tests (4): ActorRef kinds; ProductWriteInput rejects negative price; ColorDTO shape; HeroSlideWriteInput minimal.

Steps: read every admin action file (admin-products, categories, hero-slides, promotional-categories, colors, admin-orders) and write the interfaces from their REAL payloads (verification duty — record the audit table in the report); TDD the 4 dto tests; implement; `npm run audit:api` additions-only; commit `feat(contract): ActorRef, AdminCatalogService, AdminOrderService, listNewArrivals`.

### Task 2: Admin conformance suite

**Files:** Create `packages/contract/src/testing/admin-conformance.ts` (+ world extensions in `admin-world.ts`: an admin user node `conformance-admin` seeded via Cypher like accountWorld's). Modify `testing/index.ts`.

Suite blocks (~10): non-admin actor on a representative write → UNAUTHORIZED (anonymous AND customer kinds); admin CRUD round-trip per family — product create→update→delete against catalog world variants; category create→assign→delete; promo create→addProduct→delete; hero create→reorder→delete; color create→toggle→delete; order listAllOrders returns the seeded-cart-user's orders (needs order world seed) + updateOrderStatus PENDING→CONFIRMED; listNewArrivals returns newest products (catalog world: p1 newest first). Unwired. Commit `feat(contract): admin conformance suite + admin world`.

### Task 3: Engine — admin services + actor wiring

**Files:** Create `packages/engine/src/admin-catalog.ts`, `admin-order.ts`; modify `engine.ts` (`for(tenant, actor?)` overload — keep existing single-arg call sites working; TenantEngine gains `adminCatalog`/`adminOrder` getters), `catalog.ts` (+listNewArrivals via product repo newest-first), `mappers/catalog.mapper.ts` (+toColorDTO if needed). Test: hermetic actor-authorization unit test (every admin method returns UNAUTHORIZED for non-admin without touching a session — mock-free by checking the guard order).

Implementation notes: per-method guard FIRST (`if (actor?.kind !== 'admin') return err('UNAUTHORIZED', 'Admin access required')`) before any repo call; write methods map repo rows → DTOs with the existing mappers; message parity for failures from the current actions (read them); `for(tenant, actor)` stores the actor; existing `for(tenant)` sites unchanged (actor undefined → storefront services unaffected). Commit `feat(engine): AdminCatalog+AdminOrder services, actor enforcement, listNewArrivals`.

### Task 4: engine-fixtures — fake admin services

**Files:** Create `fake-admin.ts`; wire `fake-admin.conformance.test.ts`; fake-engine `for()` accepts and stores actor (additive). In-memory CRUD over the fixture worlds (products list = worldProducts copy; colors map; etc.). Commit `feat(engine-fixtures): fake admin services passing admin conformance`. Target: npm test = 77 + dto(4) + admin suite blocks passed.

### Task 5: Real-engine admin integration

**Files:** Create `packages/engine/test/admin.integration.test.ts` (structure per account file; seeds catalog+cart+order+account worlds + admin user; runner composes adminCatalog/adminOrder/catalog with an ADMIN actor, plus a second engine.for() with a customer actor for the UNAUTHORIZED blocks). DB clean after (admin world teardown + existing set). Commit `test(engine): real-engine admin conformance run`.

### Task 6: App switch — admin actions → services (writes)

**Files:** Modify `admin-products.ts`, `categories.ts`, `hero-slides.ts`, `promotional-categories.ts`, `colors.ts`, `admin-orders.ts`, `lib/engine.ts` (+`getAdminServices()` building the actor from `getCurrentUser()`/`isAdmin()` — read lib/auth.ts: role comes from the JWT; actor = role==='ADMIN' ? {kind:'admin',userId} : userId ? {kind:'customer',userId} : {kind:'anonymous'}).

Every exported action keeps name + envelope; body becomes service call with the actor; error mapping UNAUTHORIZED→'Unauthorized: Admin access required' (or the action's current string). `getNewArrivals` homepage read → `catalog.listNewArrivals`. AdminProductsClient optimistic-create → uses createProduct's returned DTO (drop toProductDTO import). `updateOrderStatusAction` (order.ts) and `getAdminOrdersAction` → adminOrder service; delete the duplicated admin-order action if one exists (verify which the UI uses — keep BOTH names if both have consumers). Commit `feat(app): admin write paths on AdminCatalog/AdminOrder services`.

### Task 7: Cleanup — collapse the scaffolding

**Files:** Modify/delete per audit: `packages/engine/src/index.ts` (DELETE flat re-exports + `internal` namespace + `toProductDTO` export — FIRST grep-audit every remaining importer and fix or delete the consumer), `apps/factorybay/src/lib/auth.ts` (delete dead hashPassword/verifyPassword/isValidEmail/validatePassword; KEEP token/cookie/getCurrentUser family), `apps/factorybay/package.json` (drop bcryptjs + @types/bcryptjs IF no importer remains — grep), `packages/engine/src/account.test.ts` (REWORK the drift-tripwire: it read the app file — now pin the engine's own validator strings against themselves or delete the tripwire and keep the direct unit tests — prefer direct), `apps/factorybay/src/lib/guest-cart.ts` (delete dead addToGuestCart/removeFromGuestCart/updateGuestCartQuantity), `FormData` type rename in ProductFormDialog (→ProductFormData, update importers), `lib/admin-product-form.ts` (retypes via contract ProductWriteInput). Then the P2–P4 deferral batch: falsy-userId UNAUTHORIZED guard in engine createOrder (+suite pin if cheap), self-merge semantics pinned (one suite line asserting user→same-user merge leaves cart intact — match whichever semantics the engine has, fake aligns), `DEFAULT_PRICE_RANGE` shared-ref fix (`{ ...DEFAULT_PRICE_RANGE }`), `images: src.images ?? []` in catalog mapper, order pages render severed-row names WITHOUT link when `productId === ''`, ProfileClient labels get `htmlFor`/`id` (spec simplifies to getByLabel), OrderConfirmation shipping display respects deliveryMethod, `order.dto.test.ts:23` test rename, db:seed MinIO soft-fail (exit 0 with warning). Commit `chore: collapse migration scaffolding + P2-P4 deferral fixes` (ONE commit; it must land after Task 6 so no importer breaks).

### Task 8: Docs + full matrix + final verify

CLAUDE.md: admin-on-engine paragraph + commands unchanged; README monorepo note gains packages list. Matrix: unit/integration counts (report exact), smoke 5 (plus admin spec if added — OPTIONAL: only if time permits, skip adding), canonical build, audit gate. Commit `docs: Phase 5 — admin services, actor enforcement, scaffolding collapsed`.

---

## Definition of Done (Phase 5)
- [ ] Contract additive: ActorRef + AdminCatalogService + AdminOrderService + listNewArrivals; snapshot gate green
- [ ] Admin conformance (fixtures + real engine): UNAUTHORIZED gating + CRUD round-trips; DB clean
- [ ] All admin write actions are service wrappers; actor enforced engine-side; envelopes unchanged
- [ ] Scaffolding collapsed: zero flat re-exports/internal/toProductDTO; dead exports + app bcryptjs gone; tripwire reworked
- [ ] Deferral batch landed (guards, pins, a11y labels, display fixes, seed soft-fail)
- [ ] Full matrix green
