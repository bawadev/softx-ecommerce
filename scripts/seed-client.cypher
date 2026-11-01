// SoftX client seed — pilot catalog data for a freshly provisioned tenant.
//
// Applied by scripts/new-client.ts via:
//   docker exec -i ecom-<client>-neo4j cypher-shell -u neo4j -p <password> < scripts/seed-client.cypher
//
// Idempotent: MERGE on stable ids + IF NOT EXISTS schema — safe to re-run.
//
// Shape notes (mirrors what @softx/engine's catalog repositories read):
//   - Prices are MAJOR units; the engine maps them to minor-unit Money via
//     v1.fromMajorAmount (59.0 -> { amountMinor: 5900, currency: 'LKR' }).
//   - `images: []` is intentional: the app template renders an image
//     placeholder when a product has no image, and the DTO mapper
//     materializes `images ?? []`.
//   - Product names are deliberately client-distinct ('Acorn ...') so
//     cross-tenant isolation is provable by name.
//   - HeroSlide.imageUrl must be a string in the DTO; '' renders the
//     template's no-image hero fallback.
//
// The data below is the acornbay pilot's committed seed. Future clients can
// pass --seed <file> to new-client with their own catalog.

// --- schema: the minimal subset the catalog reads rely on ---
CREATE CONSTRAINT product_id_unique IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT variant_id_unique IF NOT EXISTS FOR (v:ProductVariant) REQUIRE v.id IS UNIQUE;
CREATE INDEX heroslide_display_order IF NOT EXISTS FOR (h:HeroSlide) ON (h.displayOrder);
CREATE INDEX heroslide_active IF NOT EXISTS FOR (h:HeroSlide) ON (h.isActive);

// --- product 1: Acorn Hoodie (newest) ---
MERGE (p1:Product {id: 'acornbay-product-hoodie'})
SET p1.name = 'Acorn Hoodie',
    p1.description = 'Heavyweight charcoal hoodie from the first Acorn Bay drop. Brushed inside, boxy fit.',
    p1.brand = 'Acorn Bay',
    p1.gender = 'UNISEX',
    p1.stockPrice = 59.0,
    p1.retailPrice = 72.0,
    p1.sku = 'AC-HOOD-001',
    p1.images = [],
    p1.createdAt = '2026-11-02T09:00:00Z',
    p1.updatedAt = '2026-11-02T09:00:00Z'
WITH p1
MERGE (v11:ProductVariant {id: 'acornbay-variant-hoodie-s'})
SET v11.productId = 'acornbay-product-hoodie', v11.size = 'S', v11.color = 'Charcoal', v11.stockQuantity = 8, v11.images = []
MERGE (v11)-[:VARIANT_OF]->(p1)
WITH p1
MERGE (v12:ProductVariant {id: 'acornbay-variant-hoodie-m'})
SET v12.productId = 'acornbay-product-hoodie', v12.size = 'M', v12.color = 'Charcoal', v12.stockQuantity = 12, v12.images = []
MERGE (v12)-[:VARIANT_OF]->(p1)
WITH p1
MERGE (v13:ProductVariant {id: 'acornbay-variant-hoodie-l'})
SET v13.productId = 'acornbay-product-hoodie', v13.size = 'L', v13.color = 'Moss', v13.stockQuantity = 6, v13.images = []
MERGE (v13)-[:VARIANT_OF]->(p1);

// --- product 2: Acorn Cap ---
MERGE (p2:Product {id: 'acornbay-product-cap'})
SET p2.name = 'Acorn Cap',
    p2.description = 'Six-panel cap in waxed moss canvas with a small embroidered acorn.',
    p2.brand = 'Acorn Bay',
    p2.gender = 'UNISEX',
    p2.stockPrice = 18.5,
    p2.retailPrice = 22.0,
    p2.sku = 'AC-CAP-002',
    p2.images = [],
    p2.createdAt = '2026-11-01T09:00:00Z',
    p2.updatedAt = '2026-11-01T09:00:00Z'
WITH p2
MERGE (v21:ProductVariant {id: 'acornbay-variant-cap-s'})
SET v21.productId = 'acornbay-product-cap', v21.size = 'S', v21.color = 'Moss', v21.stockQuantity = 15, v21.images = []
MERGE (v21)-[:VARIANT_OF]->(p2)
WITH p2
MERGE (v22:ProductVariant {id: 'acornbay-variant-cap-m'})
SET v22.productId = 'acornbay-product-cap', v22.size = 'M', v22.color = 'Sand', v22.stockQuantity = 9, v22.images = []
MERGE (v22)-[:VARIANT_OF]->(p2);

// --- product 3: Acorn Tote (not on sale) ---
MERGE (p3:Product {id: 'acornbay-product-tote'})
SET p3.name = 'Acorn Tote',
    p3.description = 'Sturdy natural-canvas tote that carries a week of groceries and shrugs it off.',
    p3.brand = 'Acorn Bay',
    p3.gender = 'UNISEX',
    p3.stockPrice = 32.0,
    p3.retailPrice = 32.0,
    p3.sku = 'AC-TOTE-003',
    p3.images = [],
    p3.createdAt = '2026-10-31T09:00:00Z',
    p3.updatedAt = '2026-10-31T09:00:00Z'
WITH p3
MERGE (v31:ProductVariant {id: 'acornbay-variant-tote-l'})
SET v31.productId = 'acornbay-product-tote', v31.size = 'L', v31.color = 'Natural', v31.stockQuantity = 20, v31.images = []
MERGE (v31)-[:VARIANT_OF]->(p3);

// --- hero slides (2) ---
MERGE (h1:HeroSlide {id: 'acornbay-hero-1'})
SET h1.imageUrl = '',
    h1.animationType = 'left-panel',
    h1.colorTheme = 'dark',
    h1.badgeText = 'First drop',
    h1.title = 'Grown from small beginnings',
    h1.subtitle = 'The Acorn Bay pilot storefront: a different UI over the same contract.',
    h1.linkUrl = '/shop',
    h1.displayOrder = 1,
    h1.isActive = true,
    h1.createdAt = '2026-11-02T08:00:00Z',
    h1.updatedAt = '2026-11-02T08:00:00Z';

MERGE (h2:HeroSlide {id: 'acornbay-hero-2'})
SET h2.imageUrl = '',
    h2.animationType = 'top-right-panel',
    h2.colorTheme = 'dark',
    h2.badgeText = 'Pilot',
    h2.title = 'Different UI. Same contract.',
    h2.subtitle = 'Every product on this page is a v1 DTO served by the shared engine.',
    h2.linkUrl = '/shop',
    h2.displayOrder = 2,
    h2.isActive = true,
    h2.createdAt = '2026-11-02T08:01:00Z',
    h2.updatedAt = '2026-11-02T08:01:00Z';
