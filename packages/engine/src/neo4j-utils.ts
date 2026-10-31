import { Integer } from 'neo4j-driver'

/**
 * Convert Neo4j Integer objects to regular JavaScript numbers recursively.
 * Uses JSON serialization to force conversion of all nested objects.
 */
export function convertNeo4jIntegers<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj

  // Use JSON.parse(JSON.stringify()) to force conversion
  try {
    return JSON.parse(JSON.stringify(obj, (_key, value) => {
      // Handle Neo4j Integer objects - they have low/high properties
      if (value !== null && typeof value === 'object' && 'low' in value && 'high' in value) {
        return value.low
      }
      // Handle Neo4j Integer class check
      if (Integer.isInteger(value)) {
        return value.toNumber()
      }
      return value
    }))
  } catch {
    return obj
  }
}
