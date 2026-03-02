# Category Hierarchy Configuration

This directory contains JSON configuration files for defining your custom category hierarchy.

## Overview

The Ecom category system is **completely flexible** and supports:
- ✅ **Infinite levels** (L0, L1, L2, L3... L100, L1000, etc.)
- ✅ **Multiple parents** (a category can belong to multiple parent categories)
- ✅ **Any structure** (Men/Women, Pets, Kids, or any other categorization)
- ✅ **Dynamic relationships** (smart auto-select and auto-deselect based on parent-child relationships)

## How It Works

### Database Structure
- **Neo4j Graph Database** with `CustomFilter` nodes
- **CHILD_OF relationships** connect children to parents
- Each filter has: `id`, `name`, `slug`, `level`, `isActive`

### Frontend Behavior
- Selecting a category **auto-selects all its parents**
- Selecting a category **auto-selects all its children**
- Deselecting a category **only removes children that have no other selected parents**

**Example:**
```
Select "Office Wear" → "Men" and "Women" auto-select
Deselect "Women" → Only women-specific items (Blouses, Skirts) deselect
                  → Shared items (Blazers, Dress Trousers) remain selected
                  → "Office Wear" remains selected (still has "Men" as parent)
```

## Configuration Files

### `category-hierarchy.json`
The main configuration file used by the system. Edit this file to modify your categories.

### `category-hierarchy-with-pets.json`
Example showing deeper nesting with Pets, Kids, and levels going up to L5.

## JSON Schema

```json
{
  "filters": [
    {
      "name": "Category Name",
      "level": 0,
      "parents": ["Parent1", "Parent2"]
    }
  ]
}
```

### Fields

- **name** (string, required): Display name of the category
- **level** (number, required): Hierarchy level (0 = root, 1 = child of root, etc.)
- **parents** (string[], optional): Array of parent category names

### Rules

1. **Level 0 categories** should have empty `parents` array
2. **Parent names must exist** in the filters array
3. **A category can have multiple parents** (creates many-to-many relationships)
4. **No limit on levels** - use any level number you need

## Usage

### 1. Edit the Configuration

Edit `category-hierarchy.json`:

```json
{
  "filters": [
    {
      "name": "Pets",
      "level": 0,
      "parents": []
    },
    {
      "name": "Dogs",
      "level": 1,
      "parents": ["Pets"]
    },
    {
      "name": "Dog Collars",
      "level": 2,
      "parents": ["Dogs"]
    }
  ]
}
```

### 2. Run the Setup Script

```bash
npm run setup:filters
```

This will:
- Clear existing filters from Neo4j
- Create new filter nodes
- Create parent-child relationships
- Display a summary of the hierarchy

### 3. Refresh Your Application

The homepage will automatically load the new categories.

## Examples

### Example 1: Men/Women Structure (Current)

```
L0: Men, Women
L1: Office Wear, Casual Wear, Sportswear (parents: Men, Women)
L2: Dress Shirts (parents: Office Wear, Men)
L2: Blouses (parents: Office Wear, Women)
L2: Blazers (parents: Office Wear, Men, Women)
```

### Example 2: Pets Structure

```
L0: Pets
L1: Dogs, Cats, Birds
L2: Dog Apparel, Dog Accessories
L3: Dog Jackets, Dog Collars
L4: Winter Jackets, Rain Jackets
L5: Small Breed Winter Jackets, Large Breed Winter Jackets
```

### Example 3: Multi-Root Structure

```
L0: Men, Women, Kids, Pets
L1: Clothing (parents: Men, Women, Kids)
L1: Accessories (parents: Men, Women, Kids, Pets)
L2: Watches (parents: Accessories, Men, Women)
L2: Pet Collars (parents: Accessories, Pets)
```

## Advanced Use Cases

### Shared Categories

A category can belong to multiple parents:

```json
{
  "name": "Unisex Sneakers",
  "level": 2,
  "parents": ["Footwear", "Men", "Women", "Kids"]
}
```

When you select "Men", "Unisex Sneakers" will be selected.
When you deselect "Men" but "Women" is still selected, "Unisex Sneakers" remains.

### Deep Nesting

No limit on depth:

```json
{
  "name": "Premium Reflective Leather Collar for Large Breeds in Winter",
  "level": 10,
  "parents": ["Large Breed Accessories"]
}
```

### Cross-Category Relationships

```json
{
  "name": "Sports Bras",
  "level": 3,
  "parents": ["Sportswear", "Women", "Fitness Equipment"]
}
```

## Testing

### Switch Between Configurations

You can create multiple config files and test different hierarchies:

```bash
# Backup current config
cp config/category-hierarchy.json config/category-hierarchy-backup.json

# Use Pets config
cp config/category-hierarchy-with-pets.json config/category-hierarchy.json

# Run setup
npm run setup:filters

# Restore original
cp config/category-hierarchy-backup.json config/category-hierarchy.json
npm run setup:filters
```

### Verify in Neo4j Browser

Visit http://localhost:7474 and run:

```cypher
// View all filters
MATCH (f:CustomFilter)
RETURN f

// View hierarchy as tree
MATCH path = (child:CustomFilter)-[:CHILD_OF*]->(root:CustomFilter)
WHERE root.level = 0
RETURN path

// Check a specific filter's parents
MATCH (f:CustomFilter {name: "Blazers"})-[:CHILD_OF]->(parent)
RETURN parent.name, parent.level
```

## Future Enhancements

Potential admin UI features:
- Visual hierarchy editor with drag-and-drop
- Live preview of filter selection behavior
- Import/export configurations
- Bulk category operations
- Category usage analytics

## Technical Details

### Files Involved

- `/config/category-hierarchy.json` - Configuration file
- `/scripts/setup-graph-hierarchy.ts` - Setup script
- `/src/app/actions/custom-filters.ts` - Server actions
- `/src/lib/repositories/custom-filter.repository.ts` - Database operations
- `/src/app/[locale]/HomePageClient.tsx` - Frontend display and interaction

### Database Queries

The system uses Cypher queries to traverse the graph:

```cypher
// Get all parents recursively
MATCH (child:CustomFilter {id: $childId})-[:CHILD_OF*]->(parent:CustomFilter)
RETURN parent.id

// Get all children recursively
MATCH (parent:CustomFilter {id: $parentId})<-[:CHILD_OF*]-(child:CustomFilter)
RETURN child.id
```

These recursive queries enable the smart selection/deselection behavior regardless of hierarchy depth.
