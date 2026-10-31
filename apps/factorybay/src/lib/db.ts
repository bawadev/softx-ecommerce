import neo4j, { Driver, Session } from 'neo4j-driver'

let driver: Driver | null = null

export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || 'neo4j://localhost:7687'
    const user = process.env.NEO4J_USER || 'neo4j'
    const password = process.env.NEO4J_PASSWORD || 'password'

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
    })
  }

  return driver
}

export function getSession(): Session {
  return getDriver().session()
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close()
    driver = null
  }
}

// Helper function to run a query
export async function runQuery<T = any>(
  query: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const session = getSession()
  try {
    const result = await session.run(query, params)
    return result.records.map((record) => record.toObject() as T)
  } finally {
    await session.close()
  }
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const session = getSession()
    await session.run('RETURN 1')
    await session.close()
    return true
  } catch (error) {
    console.error('Neo4j connection failed:', error)
    return false
  }
}
