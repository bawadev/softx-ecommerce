/**
 * verify:tenants — multi-client TENANT ISOLATION regression check (Phase 6 Task 3).
 *
 * Run: npm run verify:tenants [-- --factory-names "A,B"]
 *
 * Creates one engine per configured tenant (factorybay + acornbay by default),
 * each pointed at ITS OWN Neo4j container, calls `catalog.listProducts` on
 * both, and asserts:
 *
 *   1. each side's expected products are present (acornbay: the committed
 *      `scripts/seed-client.cypher` names; factorybay: non-empty, plus any
 *      names passed via --factory-names — e.g. the SMOKE-* seed products),
 *   2. the two catalogs are DISJOINT — no shared product name, no shared
 *      product id. A leak in either direction fails the check.
 *
 * Why sequential env phases: the engine's Neo4j driver is a module singleton
 * constructed lazily from `process.env` on first query (`db.getDriver()`); a
 * `createEngine(config)` only carries the database name forward. So this
 * script runs tenants strictly one-after-another and calls
 * `internal.db.closeDriver()` between phases — the next query then builds a
 * fresh driver against the NEXT tenant's env. Never interleave the phases.
 *
 * Endpoints default to the local dev containers; override per tenant with
 * FACTORYBAY_NEO4J_URI / ACORNBAY_NEO4J_URI (+ _NEO4J_PASSWORD) if some other
 * environment hosts them.
 */

import { createEngine, engineConfigFromEnv, internal } from '@softx/engine'

interface TenantPhase {
  key: string
  container: string
  env: Record<string, string>
  /** Names that MUST appear in this tenant's catalog (empty = just non-empty). */
  expected: string[]
}

function readFlag(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const factoryNamesArg = readFlag('--factory-names')

const TENANTS: TenantPhase[] = [
  {
    key: 'factorybay',
    container: 'ecommerce-neo4j (docker compose up -d neo4j)',
    env: {
      CLIENT_ID: 'factorybay',
      NEO4J_URI: process.env.FACTORYBAY_NEO4J_URI || 'neo4j://localhost:7687',
      NEO4J_USER: 'neo4j',
      NEO4J_PASSWORD: process.env.FACTORYBAY_NEO4J_PASSWORD || 'ecommerce123',
      DEFAULT_CURRENCY: 'LKR',
    },
    expected: factoryNamesArg
      ? factoryNamesArg.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
  },
  {
    key: 'acornbay',
    container: 'ecom-acornbay-neo4j (docker compose -f docker-compose.acornbay.yml up -d)',
    env: {
      CLIENT_ID: 'acornbay',
      NEO4J_URI: process.env.ACORNBAY_NEO4J_URI || 'neo4j://localhost:7601',
      NEO4J_USER: 'neo4j',
      NEO4J_PASSWORD: process.env.ACORNBAY_NEO4J_PASSWORD || 'acornbay123',
      DEFAULT_CURRENCY: 'LKR',
    },
    expected: ['Acorn Hoodie', 'Acorn Cap', 'Acorn Tote'], // scripts/seed-client.cypher
  },
]

async function listAllProducts(tenant: TenantPhase): Promise<{ names: string[]; ids: string[]; total: number }> {
  const catalog = createEngine(engineConfigFromEnv()).for({ clientId: tenant.key }).catalog
  const names: string[] = []
  const ids: string[] = []
  let total = 0
  const limit = 100
  for (let offset = 0; offset === 0 || offset < total; offset += limit) {
    const result = await catalog.listProducts({ limit, offset })
    if (!result.ok) {
      throw new Error(`[${tenant.key}] catalog.listProducts failed: ${result.error.code} — ${result.error.message}`)
    }
    total = result.data.total
    for (const item of result.data.items) {
      names.push(item.name)
      ids.push(item.id)
    }
    if (result.data.items.length === 0) break
  }
  return { names, ids, total }
}

async function main(): Promise<number> {
  const failures: string[] = []
  const catalogs: Record<string, { names: string[]; ids: string[]; total: number }> = {}

  console.log('verify:tenants — multi-client tenant isolation check (Phase 6)\n')

  for (const tenant of TENANTS) {
    // Drop the previous phase's driver so this phase's first query builds a
    // fresh one from THIS tenant's env (see header — load-bearing).
    await internal.db.closeDriver()
    Object.assign(process.env, tenant.env)

    let entry = { names: [] as string[], ids: [] as string[], total: 0 }
    try {
      entry = await listAllProducts(tenant)
    } catch (e) {
      failures.push(e instanceof Error ? e.message : String(e))
    }
    catalogs[tenant.key] = entry

    console.log(`[${tenant.key}] ${tenant.env.NEO4J_URI}`)
    console.log(`  container: ${tenant.container}`)
    console.log(`  products (${entry.total}): ${entry.names.length ? entry.names.slice().sort().join(', ') : '(none)'}`)

    if (entry.names.length === 0 && !failures.some((f) => f.startsWith(`[${tenant.key}] catalog.listProducts`))) {
      failures.push(
        `[${tenant.key}] catalog is EMPTY — start its container and seed it first ` +
          (tenant.key === 'factorybay'
            ? '(apps/factorybay/scripts/seed-smoke-products.cypher)'
            : '(npm run new-client -- --client acornbay)')
      )
    }
    const missing = tenant.expected.filter((n) => !entry.names.includes(n))
    if (missing.length > 0) failures.push(`[${tenant.key}] expected products missing: ${missing.join(', ')}`)
    const dupes = entry.names.filter((n, i) => entry.names.indexOf(n) !== i)
    if (dupes.length > 0) failures.push(`[${tenant.key}] duplicate names within one tenant: ${[...new Set(dupes)].join(', ')}`)
  }
  await internal.db.closeDriver()

  console.log('\nexpected-products check:')
  for (const tenant of TENANTS) {
    const want = tenant.expected.length ? tenant.expected.join(', ') : '(catalog non-empty)'
    const bad = failures.some((f) => f.startsWith(`[${tenant.key}]`))
    console.log(`  ${tenant.key}: ${want} ${bad ? 'FAIL' : 'OK'}`)
  }

  const [a, b] = [TENANTS[0].key, TENANTS[1].key]
  const nameOverlap = [...new Set(catalogs[a].names.filter((n) => catalogs[b].names.includes(n)))]
  const idOverlap = [...new Set(catalogs[a].ids.filter((id) => catalogs[b].ids.includes(id)))]

  console.log('\ndisjointness check:')
  console.log(`  name-set intersection (${a} ∩ ${b}): [${nameOverlap.join(', ')}] — ${nameOverlap.length === 0 ? 'OK (disjoint)' : 'FAIL'}`)
  console.log(`  id-set intersection   (${a} ∩ ${b}): [${idOverlap.join(', ')}] — ${idOverlap.length === 0 ? 'OK (disjoint)' : 'FAIL'}`)
  if (nameOverlap.length > 0) failures.push(`name-set intersection non-empty: ${nameOverlap.join(', ')}`)
  if (idOverlap.length > 0) failures.push(`id-set intersection non-empty: ${idOverlap.join(', ')}`)

  console.log()
  if (failures.length > 0) {
    console.error('TENANT ISOLATION CHECK FAILED:')
    for (const f of failures) console.error(`  - ${f}`)
    return 1
  }
  console.log(
    `TENANT ISOLATION PROVEN: ${a} (${catalogs[a].total} products) and ${b} (${catalogs[b].total} products) ` +
      `have disjoint catalogs — each engine sees only its own container's data.`
  )
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
