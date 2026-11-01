import type { v1 } from '@softx/contract'
import { createCatalogService } from './catalog'
import { createCartService } from './cart'
import { createOrderService } from './order'
import { createAccountService } from './account'
import { createProfileService } from './profile'
import { createAdminCatalogService } from './admin-catalog'
import { createAdminOrderService } from './admin-order'

export interface EngineConfig {
  neo4j: {
    uri: string
    user: string
    password: string
    /** Neo4j database name; defaults to env NEO4J_DATABASE or the server default */
    database?: string
  }
  /** ISO-4217 code used when mapping prices; default env DEFAULT_CURRENCY or 'LKR' */
  defaultCurrency?: string
}

export interface TenantRef {
  clientId: string
}

export interface TenantEngine {
  readonly catalog: v1.CatalogService
  readonly cart: v1.CartService
  readonly order: v1.OrderService
  readonly account: v1.AccountService
  readonly profile: v1.ProfileService
  /**
   * Admin write surface (Phase 5). Every method takes the ActorRef as its
   * first argument and enforces `kind === 'admin'` engine-side, returning
   * UNAUTHORIZED ('Admin access required') before any repository work.
   */
  readonly adminCatalog: v1.AdminCatalogService
  readonly adminOrder: v1.AdminOrderService
}

export interface Engine {
  /**
   * Bind a tenant engine. The optional `actor` (Phase 5, additive) captures
   * the acting party on the returned TenantEngine — existing single-argument
   * call sites keep working with the actor left undefined, and the
   * storefront services are unaffected either way. Authorization on the
   * admin services always reads the PER-CALL ActorRef (the contract passes
   * it as every method's first argument); the captured actor is bound
   * context only and is never consulted for an authorization decision.
   */
  for(tenant: TenantRef, actor?: v1.ActorRef): TenantEngine
}

export function createEngine(config: EngineConfig): Engine {
  const engine: Engine = {
    for(tenant: TenantRef, actor?: v1.ActorRef): TenantEngine {
      return {
        get catalog(): v1.CatalogService {
          return createCatalogService(config, tenant)
        },
        get cart(): v1.CartService {
          return createCartService(config, tenant)
        },
        get order(): v1.OrderService {
          return createOrderService(config, tenant)
        },
        get account(): v1.AccountService {
          return createAccountService(config, tenant)
        },
        get profile(): v1.ProfileService {
          return createProfileService(config, tenant)
        },
        get adminCatalog(): v1.AdminCatalogService {
          return createAdminCatalogService(config, tenant, actor)
        },
        get adminOrder(): v1.AdminOrderService {
          return createAdminOrderService(config, tenant, actor)
        },
      }
    },
  }
  return engine
}

/** Read EngineConfig from environment (used by apps and scripts). */
export function engineConfigFromEnv(): EngineConfig {
  return {
    neo4j: {
      uri: process.env.NEO4J_URI || 'neo4j://localhost:7687',
      user: process.env.NEO4J_USER || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password',
      database: process.env.NEO4J_DATABASE || undefined,
    },
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'LKR',
  }
}
