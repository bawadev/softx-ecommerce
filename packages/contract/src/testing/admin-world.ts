// Admin conformance world (Phase 5 Task 2).
//
// A single :User node with role 'ADMIN' so the admin actor's userId points at
// a real node (node shape mirrors user.repository: {id, email, passwordHash,
// role, firstName, lastName, createdAt, updatedAt}).
//
// Unlike accountWorld — whose seedCypher is a FUNCTION because the account
// suite authenticates and needs a runtime-generated hash — the admin suite
// NEVER authenticates (admin services take the ActorRef on trust; the actor
// check is `kind === 'admin'`, not a session lookup). So the seed is a STATIC
// string with a placeholder hash, exactly like cartWorld's 'x'.
//
// Seeding order: run AFTER catalogWorld.teardownCypher. catalogWorld's
// `n.id STARTS WITH 'conformance-'` prefix teardown also matches
// 'conformance-admin' (and cartWorld's matches 'conformance-cart-*' users),
// so a catalog/cart teardown removes this node — seed admin LAST, and
// teardown order never resurrects anything.
//
// Suite-created rows this world does NOT own: orders checked out by the
// order-admin block carry engine-generated uuid ids that escape every prefix
// teardown (the contract has no deleteOrder) — real-engine runners must keep
// their existing order-row cleanup, as order.integration.test.ts already
// does for runOrderConformance. Everything else the admin suite creates is
// deleted through the admin service surface inside the suite itself.

import type { ActorRef } from '../v1'

/** Admin ActorRef the suite passes as the first argument of every admin call. */
const adminActor: ActorRef = { kind: 'admin', userId: 'conformance-admin' }

export const adminWorld = {
  /** Identity of the seeded admin (node property the DB-side seed writes). */
  admin: {
    id: 'conformance-admin',
    email: 'conformance-admin@example.com',
    firstName: 'Conformance',
    lastName: 'Admin',
  },
  /** The admin actor derived from that node (engine checks kind, not the DB). */
  actor: adminActor,
  /**
   * Creates the seeded ADMIN :User. Not idempotent (CREATE, like the other
   * worlds' seeds) — run teardownCypher first when resetting.
   */
  seedCypher: `
    CREATE (:User {id: 'conformance-admin', email: 'conformance-admin@example.com',
      passwordHash: 'x', role: 'ADMIN', firstName: 'Conformance', lastName: 'Admin',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'})
  `,
  /** Removes the seeded admin node (suite-created catalog rows self-clean). */
  teardownCypher: `MATCH (n:User {id: 'conformance-admin'}) DETACH DELETE n`,
}
