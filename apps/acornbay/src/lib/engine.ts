import { createEngine, engineConfigFromEnv, type Engine } from '@softx/engine'

/**
 * This app's embedded engine, configured purely from env (own Neo4j
 * container, own currency default). One driver per app process; the engine
 * is tenant-bound per call below, so the single instance is shared.
 */
let engine: Engine | null = null

export function getEngine(): Engine {
  if (!engine) {
    engine = createEngine(engineConfigFromEnv())
  }
  return engine
}

/**
 * Catalog reads for THIS tenant. CLIENT_ID selects the data partition —
 * the same engine code serves every client, only the id (and the Neo4j
 * endpoint it points at) differs. This pilot is catalog-only; cart, order,
 * account, profile and the admin services hang off the same
 * `for({ clientId })` binding when a client grows beyond the catalog.
 */
export function getCatalog() {
  return getEngine().for({ clientId: process.env.CLIENT_ID || 'template' }).catalog
}
