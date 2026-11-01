import { describe, beforeAll, afterAll } from 'vitest'
import neo4j from 'neo4j-driver'
import { runOrderConformance, catalogWorld, cartWorld } from '@softx/contract/testing'
import { createEngine, engineConfigFromEnv, type Engine } from '../src/engine'
import { closeDriver } from '../src/db'

/**
 * Real-engine order conformance run (Phase 3 Task 6).
 *
 * Runs the SAME shared order conformance suite the fake engine passes
 * (`@softx/contract` testing subpath) against the real `@softx/engine`
 * OrderService backed by a live Neo4j.
 *
 * Gated on RUN_INTEGRATION=1 so plain `npm test` skips this file cleanly.
 * The catalog world is seeded FIRST and the cart world second (the cart
 * seed MATCHes conformance-v1 and creates the `conformance-cart-user` User
 * node that order.repository's `MATCH (u:User {id})` requires).
 *
 * Ordering constraint (Task 3 review): the order suite leaves the shared
 * user's cart CLEARED, while the cart suite's first user read expects the
 * SEEDED 2x conformance-v1 line. The cart suite stays in its own file
 * (cart.integration.test.ts) and each integration file tears down and
 * re-seeds the whole conformance world in its own beforeAll — and under
 * RUN_INTEGRATION=1 vitest runs files serially — so the suites can never
 * observe each other's leftovers regardless of file order. There is no
 * third suite needing the seeded line after this file's clears.
 *
 * Idempotency beyond the world prefix teardowns: orders created by the
 * suite get repo-generated uuid ids and `FB-<timestamp>` order numbers that
 * escape BOTH prefix teardowns. Real shapes (order.repository.ts):
 *   (:User {id})-[:PLACED_ORDER]->(:Order {userId, ...})
 *   (:Order)-[:HAS_ITEM]->(:OrderItem {orderId, variantId, ...})
 *   (:OrderItem)-[:ITEM_OF_VARIANT]->(:ProductVariant)
 * `DETACH DELETE` on the Order alone would orphan its OrderItem nodes, so
 * the order cleanup deletes items and orders together, matched by the
 * Order's `userId` property (robust even if the User node is already gone).
 *
 * Env: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD. NEO4J_DATABASE is optional —
 * the repositories thread the tenant database since Phase 2 Task 1.
 */
const RUN = process.env.RUN_INTEGRATION === '1'

const ORDER_TEARDOWN_CYPHER = `
  MATCH (o:Order {userId: 'conformance-cart-user'})
  OPTIONAL MATCH (o)-[:HAS_ITEM]->(oi:OrderItem)
  DETACH DELETE oi, o
`

describe.skipIf(!RUN)('real engine: order conformance (live Neo4j)', () => {
  let engine: Engine
  let driver: ReturnType<typeof neo4j.driver>

  async function runCypher(cypher: string): Promise<void> {
    const config = engineConfigFromEnv()
    const session = driver.session(config.neo4j.database ? { database: config.neo4j.database } : undefined)
    try {
      await session.run(cypher)
    } finally {
      await session.close()
    }
  }

  beforeAll(async () => {
    const config = engineConfigFromEnv()
    engine = createEngine(config)
    driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
    )
    await driver.verifyConnectivity()
    // Idempotent reset of any stale conformance nodes (both worlds, plus
    // engine-written cart lines whose uuid ids escape the prefix teardowns,
    // plus this suite's orders and their order items).
    await runCypher(catalogWorld.teardownCypher)
    await runCypher(cartWorld.teardownCypher)
    await runCypher(`MATCH (c:CartItem {userId: 'conformance-cart-user'}) DETACH DELETE c`)
    await runCypher(ORDER_TEARDOWN_CYPHER)
    // Seed catalog world first — the cart seed MATCHes conformance-v1.
    await runCypher(catalogWorld.seedCypher)
    await runCypher(cartWorld.seedCypher)
  }, 60_000)

  afterAll(async () => {
    try {
      if (driver) {
        await runCypher(cartWorld.teardownCypher)
        await runCypher(`MATCH (c:CartItem {userId: 'conformance-cart-user'}) DETACH DELETE c`)
        await runCypher(ORDER_TEARDOWN_CYPHER)
        await runCypher(catalogWorld.teardownCypher)
        await driver.close()
      }
    } finally {
      // Close the engine's pooled driver too, so the vitest process can exit.
      await closeDriver()
    }
  })

  runOrderConformance('real-engine', () => {
    const tenant = engine.for({ clientId: 'conformance' })
    return { ...tenant.catalog, ...tenant.cart, ...tenant.order }
  })
})
