// Mirrors apps/factorybay/scripts/seed-test-products.ts fixtures (image-free,
// MinIO not required). Deterministic SKUs+ids so re-running is idempotent.
// Variant direction matches the engine: (ProductVariant)-[:VARIANT_OF]->(Product).
MATCH (p:Product) WHERE p.sku STARTS WITH 'SMOKE-' OPTIONAL MATCH (v:ProductVariant)-[:VARIANT_OF]->(p) DETACH DELETE p, v;

CREATE (p1:Product {id: 'smoke-prod-001', name: 'Classic Cotton T-Shirt', description: 'Premium quality cotton t-shirt, comfortable and durable.', brand: 'UrbanStyle', gender: 'MEN', stockPrice: 850, retailPrice: 1500, sku: 'SMOKE-UST-001', category: 'SHIRT', images: [], createdAt: toString(datetime()), updatedAt: toString(datetime())})
CREATE (p2:Product {id: 'smoke-prod-002', name: 'Slim Fit Chinos', description: 'Modern slim-fit chinos for everyday wear.', brand: 'DenimCo', gender: 'MEN', stockPrice: 1200, retailPrice: 2200, sku: 'SMOKE-DC-002', category: 'PANTS', images: [], createdAt: toString(datetime()), updatedAt: toString(datetime())})
CREATE (p3:Product {id: 'smoke-prod-003', name: 'Floral Summer Dress', description: 'Elegant floral dress perfect for summer outings.', brand: 'BloomWear', gender: 'WOMEN', stockPrice: 1500, retailPrice: 2800, sku: 'SMOKE-BW-003', category: 'DRESS', images: [], createdAt: toString(datetime()), updatedAt: toString(datetime())})
CREATE (p4:Product {id: 'smoke-prod-004', name: 'Leather Biker Jacket', description: 'Classic leather jacket with modern styling.', brand: 'EdgeWear', gender: 'UNISEX', stockPrice: 3500, retailPrice: 6500, sku: 'SMOKE-EW-004', category: 'JACKET', images: [], createdAt: toString(datetime()), updatedAt: toString(datetime())});

MATCH (p1:Product {id: 'smoke-prod-001'})
CREATE (:ProductVariant {id: 'smoke-var-001-M', productId: 'smoke-prod-001', size: 'M', color: 'White', stockQuantity: 30, images: []})-[:VARIANT_OF]->(p1)
CREATE (:ProductVariant {id: 'smoke-var-001-L', productId: 'smoke-prod-001', size: 'L', color: 'White', stockQuantity: 20, images: []})-[:VARIANT_OF]->(p1);
