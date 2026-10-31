import { createEngine, engineConfigFromEnv, type Engine } from '@softx/engine'

let engine: Engine | null = null

export function getEngine(): Engine {
  if (!engine) {
    engine = createEngine(engineConfigFromEnv())
  }
  return engine
}

export function getCatalog() {
  return getEngine().for({ clientId: process.env.CLIENT_ID || 'factorybay' }).catalog
}
