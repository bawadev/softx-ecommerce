import type { v1 } from '@softx/contract'
import { createCatalogService } from './catalog'
import { createCartService } from './cart'
import { createOrderService } from './order'
import { createAccountService } from './account'
import { createProfileService } from './profile'

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
}

export interface Engine {
  for(tenant: TenantRef): TenantEngine
}

export function createEngine(config: EngineConfig): Engine {
  const engine: Engine = {
    for(tenant: TenantRef): TenantEngine {
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
