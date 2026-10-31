import { describe, it, expect } from 'vitest'
import { createEngine, engineConfigFromEnv } from './engine'

describe('createEngine', () => {
  it('builds a tenant engine per tenant', () => {
    const engine = createEngine({
      neo4j: { uri: 'neo4j://localhost:7687', user: 'neo4j', password: 'x' },
      defaultCurrency: 'LKR',
    })
    const t1 = engine.for({ clientId: 'factorybay' })
    expect(t1.catalog).toBeDefined()
    const t2 = engine.for({ clientId: 'other' })
    expect(t2).not.toBe(t1)
  })

  it('engineConfigFromEnv defaults currency to LKR', () => {
    expect(engineConfigFromEnv().defaultCurrency).toBe('LKR')
  })
})
