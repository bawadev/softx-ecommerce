import { describe, beforeAll, afterAll } from 'vitest'
import neo4j from 'neo4j-driver'
import bcrypt from 'bcryptjs'
import { runAccountConformance, catalogWorld, cartWorld, accountWorld } from '@softx/contract/testing'
import { createEngine, engineConfigFromEnv, type Engine } from '../src/engine'
import { closeDriver } from '../src/db'

/**
 * Real-engine account+profile conformance run (Phase 4 Task 5).
 *
 * Runs the SAME shared account conformance suite the fake engine passes
 * (`@softx/contract` testing subpath) against the real `@softx/engine`
 * AccountService + ProfileService backed by a live Neo4j.
 *
 * Gated on RUN_INTEGRATION=1 so plain `npm test` skips this file cleanly.
 *
 * Seeding: catalogWorld FIRST (the suite's trackProductView block needs the
 * catalog world's :Product 'conformance-p1', and listSimilarProducts needs
 * products), then the account world — whose seedCypher takes a RUNTIME
 * password hash (the world is hash-free by design). The hash is a REAL
 * bcrypt hash of accountWorld.password at the engine's SALT_ROUNDS = 12
 * (packages/engine/src/account.ts), so authenticate's bcrypt.compare runs
 * against production-grade hashes, not test shortcuts. Order matters:
 * catalogWorld.teardownCypher also deletes 'conformance-acct-user' (its
 * prefix match `n.id STARTS WITH 'conformance-'` catches it), so the
 * account user must be (re)created AFTER the catalog seed.
 *
 * The cart world is NOT seeded (the account suite never touches a cart),
 * but its teardown — plus the uuid-CartItem clause and the order teardown —
 * IS part of the reset: this file copies the established cross-file cleanup
 * set (see order.integration.test.ts) so that, with every integration file
 * resetting the whole conformance world in its own beforeAll under serial
 * RUN_INTEGRATION execution, any file order is safe.
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

describe.skipIf(!RUN)('real engine: account+profile conformance (live Neo4j)', () => {
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
    // cleanup set (all three worlds' teardowns + uuid CartItems + this
    // suite family's orders). accountWorld.teardownCypher also sweeps the
    // preference/measurement/view nodes the account suite writes (0cef6ee)
    // and every 'conformance-acct-*' user signUp created.
    await runCypher(catalogWorld.teardownCypher)
    await runCypher(cartWorld.teardownCypher)
    await runCypher(accountWorld.teardownCypher)
    await runCypher(`MATCH (c:CartItem {userId: 'conformance-cart-user'}) DETACH DELETE c`)
    await runCypher(ORDER_TEARDOWN_CYPHER)
    // Seed catalog world first, then the account world with a runtime bcrypt
    // hash (SALT_ROUNDS = 12, parity with the engine's account service).
    await runCypher(catalogWorld.seedCypher)
    const passwordHash = bcrypt.hashSync(accountWorld.password, 12)
    await runCypher(accountWorld.seedCypher(passwordHash))
  }, 60_000)

  afterAll(async () => {
    try {
      if (driver) {
        await runCypher(accountWorld.teardownCypher)
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

  runAccountConformance('real-engine', () => {
    const tenant = engine.for({ clientId: 'conformance' })
    return { ...tenant.account, ...tenant.profile, ...tenant.catalog }
  })
})
