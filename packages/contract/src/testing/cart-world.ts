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
