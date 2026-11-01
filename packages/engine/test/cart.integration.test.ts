import { describe, beforeAll, afterAll } from 'vitest'
import neo4j from 'neo4j-driver'
import { runCartConformance, catalogWorld, cartWorld } from '@softx/contract/testing'
import { createEngine, engineConfigFromEnv, type Engine } from '../src/engine'
import { closeDriver } from '../src/db'

/**
 * Real-engine cart conformance run (Phase 2 Task 6).
 *
 * Runs the SAME shared cart conformance suite the fake engine passes
 * (`@softx/contract` testing subpath) against the real `@softx/engine`
 * CartService backed by a live Neo4j.
 *
 * Gated on RUN_INTEGRATION=1 so plain `npm test` skips this file cleanly.
 * The cart conformance hydrates prices from the catalog world, so
 * catalogWorld.seedCypher is seeded FIRST and cartWorld.seedCypher second
 * (the cart seed MATCHes conformance-v1).
 *
 * Idempotency: besides the prefix teardowns of both worlds, the engine's
 * restore step in the "user cart" conformance test re-creates the seeded
 * line via addItem, which assigns it a uuid id that escapes both prefix
 * teardowns — so any CartItem row for the conformance user is deleted
 * explicitly before seeding and in afterAll (Task 3 review follow-up).
 *
 * Env: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD. NEO4J_DATABASE is optional —
 * the repositories thread the tenant database since Phase 2 Task 1.
 */
const RUN = process.env.RUN_INTEGRATION === '1'

describe.skipIf(!RUN)('real engine: cart conformance (live Neo4j)', () => {
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
    // engine-written cart lines whose uuid ids escape the prefix teardowns).
    await runCypher(catalogWorld.teardownCypher)
    await runCypher(cartWorld.teardownCypher)
    await runCypher(`MATCH (c:CartItem {userId: 'conformance-cart-user'}) DETACH DELETE c`)
    // Seed catalog world first — the cart seed MATCHes conformance-v1.
    await runCypher(catalogWorld.seedCypher)
    await runCypher(cartWorld.seedCypher)
  }, 60_000)

  afterAll(async () => {
    try {
      if (driver) {
        await runCypher(cartWorld.teardownCypher)
        await runCypher(`MATCH (c:CartItem {userId: 'conformance-cart-user'}) DETACH DELETE c`)
        await runCypher(catalogWorld.teardownCypher)
        await driver.close()
      }
    } finally {
      // Close the engine's pooled driver too, so the vitest process can exit.
      await closeDriver()
    }
  })

  runCartConformance('real-engine', () => {
    const tenant = engine.for({ clientId: 'conformance' })
    return { ...tenant.catalog, ...tenant.cart }
  })
})
