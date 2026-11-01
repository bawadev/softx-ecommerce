// Account/profile conformance world (Phase 4 Task 2).
//
// HASH-FREE BY DESIGN: password hashes are engine-owned and never leave the
// engine, so the world cannot bake one in at module load. `seedCypher` is a
// FUNCTION taking the hash — the RUNNER generates it at runtime (real engine:
// bcrypt hash of `accountWorld.password`; fake engine: the `fake:<password>`
// marker per the Task 4 fake-account semantics) and passes it in.
//
// Seeding order: run AFTER catalogWorld.seedCypher. The suite's
// trackProductView block MATCHes BOTH the seeded :User and the catalog
// world's :Product 'conformance-p1' (browsing-history.repository requires
// both nodes to exist). Note catalogWorld.teardownCypher's
// `n.id STARTS WITH 'conformance-'` also matches 'conformance-acct-user', so
// a catalog teardown removes this user — seed account AFTER catalog, and
// teardown order never resurrects anything.
//
// Node shape mirrors user.repository / cart-world reality:
//   (:User {id, email, passwordHash, role, firstName, lastName, createdAt, updatedAt})

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

export const accountWorld = {
  /** Identity of the seeded account (asserted by the suite). */
  user: {
    id: 'conformance-acct-user',
    email: 'conformance-acct@example.com',
    firstName: 'Conformance',
    lastName: 'Account',
  },
  /**
   * The seeded account's password. Runners hash THIS string to build
   * seedCypher(passwordHash); exporting it keeps fake-engine marker and
   * real-engine bcrypt seed from drifting apart.
   */
  password: 'Conformance123!',
  /**
   * Creates the seeded :User with the RUNNER-generated passwordHash.
   * Not idempotent on its own (CREATE, like the other worlds' seeds) — run
   * teardownCypher first when resetting.
   */
  seedCypher: (passwordHash: string) => `
    CREATE (:User {id: 'conformance-acct-user', email: 'conformance-acct@example.com',
      passwordHash: ${q(passwordHash)}, role: 'CUSTOMER', firstName: 'Conformance', lastName: 'Account',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'})
  `,
  /**
   * Removes the seeded user, every account the suite signs up (the suite pins
   * signup emails to the 'conformance-acct-' prefix for exactly this match),
   * AND the suite-created nodes whose uuid ids escape the User-based matches
   * (labels/property verified against the repositories: user-profile.repository
   * MERGEs :UserPreference/:UserMeasurements on {userId};
   * browsing-history.repository creates :ProductView WITH a userId property —
   * property form, no path match needed). The suite only writes these for the
   * seeded id, so userId = 'conformance-acct-user' sweeps them all; without
   * it, a re-run's "unset reads as defaults" blocks would see stale nodes.
   *
   * The keyword-OR label expression ((n:A OR n:B)) requires Cypher 25
   * (Neo4j 5.26+/2025.x) — syntax verified against the live dev server
   * (neo4j:latest = 2026.10.1).
   */
  teardownCypher: `MATCH (n) WHERE n.id = 'conformance-acct-user' OR (n:User AND n.email STARTS WITH 'conformance-acct-') OR ((n:UserPreference OR n:UserMeasurements OR n:ProductView) AND n.userId = 'conformance-acct-user') DETACH DELETE n`,
}
