import { runAccountConformance } from '@softx/contract/testing'
import { createFakeEngine } from './fake-engine'

runAccountConformance('engine-fixtures', () => {
  // ONE fake-engine instance shared across account/profile/catalog: the
  // profile service tracks views for users the account service created (same
  // users map), and product reads resolve against the same catalog fixture
  // world (worldProducts).
  const t = createFakeEngine().for({ clientId: 'conformance' })
  return { ...t.account, ...t.profile, ...t.catalog }
})
