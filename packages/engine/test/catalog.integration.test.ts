import { describe, beforeAll, afterAll } from 'vitest'
import neo4j from 'neo4j-driver'
import { testing } from '@softx/contract'
import { createEngine, engineConfigFromEnv, type Engine } from '../src/engine'
import { closeDriver } from '../src/db'

/**
 * Real-engine catalog conformance run (Task 10).
 *
 * Runs the SAME shared conformance suite the fake engine passes
 * (`@softx/contract` testing subpath) against the real `@softx/engine`
 * CatalogService backed by a live Neo4j.
 *
 * Gated on RUN_INTEGRATION=1 so plain `npm test` skips this file cleanly.
 * The graph world (products/variants/categories/promo/hero slides) is seeded
 * from the contract's `catalogWorld.seedCypher` — the single source of truth
 * shared with the fake-engine runner — and torn down via `teardownCypher`
 * (deletes every node whose id starts with 'conformance-').
 *
 * Env: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD. NEO4J_DATABASE must stay
 * UNSET — the product repository reads the server's default database.
 */
const RUN = process.env.RUN_INTEGRATION === '1'

describe.skipIf(!RUN)('real engine: catalog conformance (live Neo4j)', () => {
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
    // Idempotent reset of any stale conformance nodes, then seed the world.
    await runCypher(testing.catalogWorld.teardownCypher)
    await runCypher(testing.catalogWorld.seedCypher)
  }, 60_000)

  afterAll(async () => {
    try {
      if (driver) {
        await runCypher(testing.catalogWorld.teardownCypher)
        await driver.close()
      }
    } finally {
      // Close the engine's pooled driver too, so the vitest process can exit.
      await closeDriver()
    }
  })

  testing.runCatalogConformance('real-engine', () =>
    engine.for({ clientId: 'conformance' }).catalog,
  )
})
