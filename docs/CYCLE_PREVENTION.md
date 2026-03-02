# Filter Hierarchy Cycle Prevention

## Overview

This document describes the comprehensive cycle prevention system implemented for the parent-child filter hierarchy in the Ecom e-commerce platform. The system prevents the creation of circular dependencies in the filter hierarchy graph.

## Types of Cycles Prevented

### 1. Direct Cycles (Self-Loop)
A filter cannot be its own parent.

```
❌ Invalid: A → A
```

### 2. Two-Node Cycles
If A is a child of B, then B cannot be a child of A.

```
✓ Valid:   A → B
❌ Invalid: A → B → A
```

### 3. Multi-Node Cycles (Indirect)
If A has B as a descendant (through any path), then B cannot have A as a parent.

```
✓ Valid:   A → B → C
❌ Invalid: A → B → C → A
```

## Implementation

### Repository Layer Functions

#### 1. `getAllAncestorFilterIds(session, filterId)`

Retrieves all ancestor IDs for a given filter recursively.

```typescript
export async function getAllAncestorFilterIds(
  session: Session,
  filterId: string
): Promise<string[]>
```

**Cypher Query:**
```cypher
MATCH path = (f:CustomFilter {id: $filterId})-[:CHILD_OF*1..]->(ancestor:CustomFilter)
RETURN DISTINCT ancestor.id as ancestorId
```

**Example:**
```typescript
// Given: A → B → C
const ancestors = await getAllAncestorFilterIds(session, 'C')
// Returns: ['B', 'A']
```

#### 2. `validateNoCycles(session, childId, parentIds)`

Validates that adding the specified parents to a child won't create any cycles.

```typescript
export async function validateNoCycles(
  session: Session,
  childId: string,
  parentIds: string[]
): Promise<{
  valid: boolean
  error?: string
  conflictingParent?: { id: string; name: string }
}>
```

**Validation Logic:**
1. Check if child filter exists
2. For each proposed parent:
   - Check if parent exists
   - Check if parent === child (self-reference)
   - Check if parent is a descendant of child (would create cycle)

**Cypher Query for Cycle Detection:**
```cypher
MATCH (child:CustomFilter {id: $childId})
MATCH (proposedParent:CustomFilter {id: $parentId})
OPTIONAL MATCH path = (proposedParent)-[:CHILD_OF*1..]->(child)
RETURN path IS NOT NULL as wouldCreateCycle
```

**Example:**
```typescript
// Given: A → B → C
const validation = await validateNoCycles(session, 'A', ['C'])
// Returns: {
//   valid: false,
//   error: 'Cannot add "C" as parent of "A" because "A" is already an ancestor of "C"',
//   conflictingParent: { id: 'C', name: 'Filter C' }
// }
```

#### 3. `updateFilterParents(session, filterId, newParentIds)`

Updates the parent relationships for a filter with automatic cycle validation and level recalculation.

```typescript
export async function updateFilterParents(
  session: Session,
  filterId: string,
  newParentIds: string[]
): Promise<{
  success: boolean
  error?: string
  conflictingParent?: { id: string; name: string }
}>
```

**Process:**
1. Validate no cycles would be created
2. Remove all existing parent relationships
3. Create new parent relationships
4. Recalculate filter level based on new parents
5. Recursively recalculate levels for all descendants

**Example:**
```typescript
// Given: A → B
const result = await updateFilterParents(session, 'A', ['B'])
// Returns: {
//   success: false,
//   error: 'Cannot add "B" as parent of "A" because "A" is already an ancestor of "B"'
// }
```

### Server Actions

All repository functions are exposed through server actions in `/src/app/actions/custom-filters.ts`:

#### `getAllAncestorFilterIdsAction(filterId)`
```typescript
const result = await getAllAncestorFilterIdsAction('filter-123')
// Returns: { success: true, data: ['parent-id', 'grandparent-id', ...] }
```

#### `validateNoCyclesAction(filterId, parentIds)`
```typescript
const result = await validateNoCyclesAction('filter-123', ['parent-456'])
// Returns: { success: true, data: { valid: true } }
// OR: { success: true, data: { valid: false, error: '...', conflictingParent: {...} } }
```

#### `updateFilterParentsAction(filterId, newParentIds)`
```typescript
const result = await updateFilterParentsAction('filter-123', ['parent-456', 'parent-789'])
// Returns: { success: true }
// OR: { success: false, error: '...' }
```

## Usage Examples

### Example 1: Creating a Valid Multi-Parent Hierarchy

```typescript
const session = getSession()

// Create root filters
const filterA = await createCustomFilter(session, 'Filter A', [])
const filterB = await createCustomFilter(session, 'Filter B', [])

// Create child with multiple parents
const filterC = await createCustomFilter(session, 'Filter C', [filterA.id, filterB.id])

// Result: A → C
//         B ↗
```

### Example 2: Preventing a Direct Cycle

```typescript
// Given: A → B
const validation = await validateNoCycles(session, filterA.id, [filterB.id])

if (!validation.valid) {
  console.error(validation.error)
  // Output: Cannot add "Filter B" as parent of "Filter A" because
  //         "Filter A" is already an ancestor of "Filter B"
}
```

### Example 3: Preventing an Indirect Cycle

```typescript
// Given: A → B → C
const validation = await validateNoCycles(session, filterA.id, [filterC.id])

if (!validation.valid) {
  console.error(validation.error)
  // Output: Cannot add "Filter C" as parent of "Filter A" because
  //         "Filter A" is already an ancestor of "Filter C"
}
```

### Example 4: Safe Parent Update

```typescript
// Given: A → B → C
//        D (separate root)

// Make C a child of both B and D
const result = await updateFilterParents(session, filterC.id, [filterB.id, filterD.id])

if (result.success) {
  // Result: A → B → C
  //         D ↗
}
```

## Error Messages

The system provides clear, actionable error messages:

| Scenario | Error Message |
|----------|--------------|
| Self-reference | `Cannot add "{name}" as its own parent` |
| Direct cycle | `Cannot add "{parentName}" as parent of "{childName}" because "{childName}" is already an ancestor of "{parentName}"` |
| Parent not found | `Parent filter with id {id} not found` |
| Child not found | `Child filter not found` |

## Testing

A comprehensive test suite is available in `/scripts/test-cycle-prevention.ts`:

```bash
npx tsx scripts/test-cycle-prevention.ts
```

**Test Coverage:**
- ✅ Direct cycle prevention
- ✅ Indirect cycle prevention
- ✅ Self-reference prevention
- ✅ Valid parent addition
- ✅ Ancestor retrieval
- ✅ Level recalculation

## Performance Considerations

### Query Efficiency

The cycle detection uses Neo4j's variable-length path matching:
```cypher
MATCH path = (proposedParent)-[:CHILD_OF*1..]->(child)
```

This is efficient for typical hierarchies (depth < 10 levels). For very deep hierarchies, consider adding a max depth limit:
```cypher
MATCH path = (proposedParent)-[:CHILD_OF*1..20]->(child)
```

### Optimization Tips

1. **Batch validation**: When adding multiple parents, validation checks all parents in a single call
2. **Early termination**: Validation stops at the first detected cycle
3. **Level caching**: Filter levels are stored and only recalculated when parent relationships change

## Integration with UI

### Admin Filter Management

When creating or editing filters in the admin UI, use the validation function before submission:

```typescript
// In your form submission handler
const handleSubmit = async (filterId: string, selectedParents: string[]) => {
  // Validate before submitting
  const validationResult = await validateNoCyclesAction(filterId, selectedParents)

  if (!validationResult.success || !validationResult.data.valid) {
    // Show error to user
    toast.error(validationResult.data.error || 'Invalid parent selection')
    return
  }

  // Proceed with update
  const result = await updateFilterParentsAction(filterId, selectedParents)
  // ...
}
```

### User-Facing Filter Selection

For user-facing filter selection (e.g., product filtering), cycle prevention is handled automatically at the data layer, so no special handling is needed in the UI.

## Future Enhancements

1. **Cycle detection optimization**: Cache ancestor paths for faster validation
2. **Bulk operations**: Add support for bulk parent updates with transaction rollback
3. **Visualization**: Add admin UI to visualize filter hierarchy and detect potential issues
4. **Constraints**: Consider adding Neo4j constraints at the database level

## Related Files

- `/src/lib/repositories/custom-filter.repository.ts` - Core implementation
- `/src/app/actions/custom-filters.ts` - Server actions
- `/scripts/test-cycle-prevention.ts` - Test suite
- `/src/lib/types.ts` - TypeScript type definitions

## References

- [Neo4j Variable Length Paths](https://neo4j.com/docs/cypher-manual/current/patterns/concepts/#patterns-variable-length-relationships)
- [Graph Cycle Detection](https://en.wikipedia.org/wiki/Cycle_(graph_theory))
