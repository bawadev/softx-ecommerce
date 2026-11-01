import { describe, beforeAll, afterAll } from 'vitest'
import neo4j from 'neo4j-driver'
import bcrypt from 'bcryptjs'
import { runAdminConformance, catalogWorld, cartWorld, accountWorld, adminWorld } from '@softx/contract/testing'
import { createEngine, engineConfigFromEnv, type Engine } from '../src/engine'
import { closeDriver } from '../src/db'

/**
 * Real-engine admin conformance run (Phase 5 Task 5).
 *
 * Runs the SAME shared admin conformance suite the fake engine passes
 * (`@softx/contract` testing subpath) against the real `@softx/engine`
 * AdminCatalogService + AdminOrderService backed by a live Neo4j.
 *
 * Gated on RUN_INTEGRATION=1 so plain `npm test` skips this file cleanly.
 *
 * Seeding (Task 3 already validated this arrangement via a throwaway runner;
 * this file makes it permanent): catalogWorld FIRST (the suite's blocks
 * assign/move the world product 'conformance-p1' and listNewArrivals expects
 * the seeded p1/p2), then cartWorld (its seed MATCHes conformance-v1 and
 * creates the 'conformance-cart-user' User node the order-admin block checks
 * out as — order.repository's `MATCH (u:User {id})` requires it), then the
 * account world with a RUNTIME bcrypt hash (SALT_ROUNDS = 12, parity with
 * packages/engine/src/account.ts — the world is hash-free by design; the
 * admin suite itself never authenticates, but seeding the full established
 * world set keeps this file's reset identical to its siblings'), and finally
 * the admin world — a STATIC seed with a placeholder hash (admin services
 * take the ActorRef on trust; the actor check is `kind === 'admin'`, not a
 * session lookup), seeded LAST per its ordering discipline.
 *
 * Actor wiring: ONE tenant instance bound with `adminWorld.actor`. The
 * contract passes the ActorRef as every admin method's FIRST argument and
 * the engine enforces `kind === 'admin'` per call, so the UNAUTHORIZED
 * blocks drive their anonymous/customer actors through the same instance;
 * the bound actor is context only (engine.ts). The storefront trio rides
 * the same tenant: several blocks verify admin writes through storefront
 * reads, and the order block checks out via cart/order services.
 *
 * Reset/teardown: the FULL established set — all four worlds' teardowns,
 * the uuid-CartItem sweep, and this suite family's order teardown. Orders
 * checked out by the order-admin block carry engine-generated uuid ids and
 * `FB-<timestamp>` order numbers that escape every prefix teardown (the
 * contract has no deleteOrder), so they are removed by the Order's userId
 * property (same arrangement as order.integration.test.ts). Every other
 * row the suite creates is deleted through the admin surface in-suite.
 * With each integration file resetting the whole conformance world in its
 * own beforeAll under serial RUN_INTEGRATION execution, any file order is
 * safe.
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

const CART_ITEM_TEARDOWN_CYPHER = `MATCH (c:CartItem {userId: 'conformance-cart-user'}) DETACH DELETE c`

describe.skipIf(!RUN)('real engine: admin conformance (live Neo4j)', () => {
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
    // Idempotent reset of any stale conformance nodes: the established
    // cleanup set across all integration files (four worlds + engine-written
    // cart lines whose uuid ids escape the prefix teardowns + this suite
    // family's orders and their order items).
    await runCypher(catalogWorld.teardownCypher)
    await runCypher(cartWorld.teardownCypher)
    await runCypher(accountWorld.teardownCypher)
    await runCypher(adminWorld.teardownCypher)
    await runCypher(CART_ITEM_TEARDOWN_CYPHER)
    await runCypher(ORDER_TEARDOWN_CYPHER)
    // Seed catalog world first (cart seed MATCHes conformance-v1), then the
    // cart world (creates the checkout user), then the account world with a
    // runtime bcrypt hash (SALT_ROUNDS = 12), then the admin world LAST
    // (static placeholder hash — the admin suite never authenticates).
    await runCypher(catalogWorld.seedCypher)
    await runCypher(cartWorld.seedCypher)
    const passwordHash = bcrypt.hashSync(accountWorld.password, 12)
    await runCypher(accountWorld.seedCypher(passwordHash))
    await runCypher(adminWorld.seedCypher)
  }, 60_000)

  afterAll(async () => {
    try {
      if (driver) {
        await runCypher(adminWorld.teardownCypher)
        await runCypher(accountWorld.teardownCypher)
        await runCypher(cartWorld.teardownCypher)
        await runCypher(CART_ITEM_TEARDOWN_CYPHER)
        await runCypher(ORDER_TEARDOWN_CYPHER)
        await runCypher(catalogWorld.teardownCypher)
        await driver.close()
      }
    } finally {
      // Close the engine's pooled driver too, so the vitest process can exit.
      await closeDriver()
    }
  })

  runAdminConformance('real-engine', () => {
    const tenant = engine.for({ clientId: 'conformance' }, adminWorld.actor)
    return { ...tenant.adminCatalog, ...tenant.adminOrder, ...tenant.catalog, ...tenant.order, ...tenant.cart }
  })
})
