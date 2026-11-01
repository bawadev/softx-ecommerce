import { createEngine, engineConfigFromEnv, type Engine } from '@softx/engine'
import type { v1 } from '@softx/contract'
import { getCurrentUser } from '@/lib/auth'

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

export function getCartService() {
  return getEngine().for({ clientId: process.env.CLIENT_ID || 'factorybay' }).cart
}

export function getOrderService() {
  return getEngine().for({ clientId: process.env.CLIENT_ID || 'factorybay' }).order
}

export function getAccountService() {
  return getEngine().for({ clientId: process.env.CLIENT_ID || 'factorybay' }).account
}

export function getProfileService() {
  return getEngine().for({ clientId: process.env.CLIENT_ID || 'factorybay' }).profile
}

/**
 * The acting party for the CURRENT request, derived from the session JWT
 * (role + userId). Every AdminCatalog/AdminOrder service method takes this
 * as its first argument and enforces `kind === 'admin'` engine-side,
 * returning UNAUTHORIZED for any other actor.
 */
export async function currentActor(): Promise<v1.ActorRef> {
  const user = await getCurrentUser()
  if (user?.role === 'ADMIN' && user.userId) return { kind: 'admin', userId: user.userId }
  if (user?.userId) return { kind: 'customer', userId: user.userId }
  return { kind: 'anonymous' }
}

/**
 * Admin write surface (Phase 5). Authorization is per-call: each action
 * passes `await currentActor()` as the service method's first argument —
 * the engine rejects non-admin actors before touching the database.
 */
export function getAdminCatalog() {
  return getEngine().for({ clientId: process.env.CLIENT_ID || 'factorybay' }).adminCatalog
}

export function getAdminOrder() {
  return getEngine().for({ clientId: process.env.CLIENT_ID || 'factorybay' }).adminOrder
}
