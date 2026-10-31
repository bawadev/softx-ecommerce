import { getSession } from '../src/lib/db'

async function checkRootCategories() {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (c:Category)
      WHERE c.level = 0
      OPTIONAL MATCH (c)-[:HAS_CHILD*0..]->(descendant:Category)<-[:HAS_CATEGORY]-(p:Product)
      WITH c, count(DISTINCT p) as productCount
      RETURN c.name as name, c.hierarchy as hierarchy, c.level as level, productCount
      ORDER BY c.name
    `)
    
    console.log('\n=== ROOT CATEGORIES (Level 0) ===\n')
    if (result.records.length === 0) {
      console.log('No root categories found!')
    } else {
      result.records.forEach(record => {
        const name = record.get('name')
        const hierarchy = record.get('hierarchy')
        const level = record.get('level')
        const count = record.get('productCount')?.toNumber() || 0
        console.log(`- ${name} (hierarchy: "${hierarchy}", level: ${level}, products: ${count})`)
      })
    }
    console.log('\n')
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await session.close()
  }
}

checkRootCategories()
