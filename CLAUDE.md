# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Ecom is a modern e-commerce platform for branded clothing at wholesale prices. Built with Next.js 15 (App Router), TypeScript, Neo4j graph database, and MinIO for object storage. The platform features internationalization (i18n) with English and Sinhala support.

## Essential Commands

### Development
```bash
# Recommended: Use dev.sh to manage all services together
./setup.sh start         # Start Neo4j, MinIO, and Next.js
./setup.sh stop          # Stop all services
./setup.sh status        # Check status
./setup.sh logs <service> # View logs (nextjs, neo4j, minio)

# Alternative: Manual start
docker compose up -d   # Start Neo4j & MinIO only
npm run dev            # Run Next.js separately
```

### Build & Production
```bash
npm run build              # Create production build
npm run start              # Start production server
npm run lint               # Run ESLint
```

### Database Management
```bash
npm run db:init            # Initialize Neo4j schema (constraints & indexes)
npm run db:seed            # Seed database with test users (IMPORTANT: Run this after db:init or db:clear)
npm run db:clear           # Clear all database data (prompts for confirmation)

# Category & Filter System
npm run setup:categories   # Setup category hierarchy (Ladies/Gents/Kids)
npm run setup:filters      # Setup graph hierarchy for categories
npm run filters:init       # Initialize custom filter system
npm run filters:validate   # Validate filter relationships
npm run filters:recalculate # Recalculate filter levels
```

**Default Test Users (created by `db:seed`):**
- Admin: `testadmin@ecommerce.com` / `Admin123!`
- Customer: `test@example.com` / `Customer123!`

### MinIO Setup
```bash
npm run minio:init         # Initialize MinIO bucket
```

### Docker Services
```bash
docker compose up -d       # Start Neo4j and MinIO
docker compose down        # Stop services
docker compose logs -f neo4j   # View Neo4j logs
docker compose logs -f minio   # View MinIO logs
```

## Architecture Overview

### Tech Stack
- **Frontend:** Next.js 15.1.4 (App Router), React 19, TypeScript 5.7
- **Styling:** Tailwind CSS 3.4, Framer Motion 11.15
- **Database:** Neo4j 5.26 (Graph Database)
- **Storage:** MinIO (S3-compatible object storage)
- **Auth:** JWT tokens in httpOnly cookies
- **i18n:** next-intl with English and Sinhala locales

### Project Structure
```
src/
├── app/
│   ├── [locale]/              # Internationalized routes
│   │   ├── page.tsx           # Homepage
│   │   ├── shop/              # Product catalog
│   │   ├── cart/              # Shopping cart
│   │   ├── checkout/          # Checkout flow
│   │   ├── order/             # Order confirmation & payment
│   │   ├── profile/           # User profile
│   │   ├── login/             # Authentication
│   │   ├── signup/
│   │   └── admin/             # Admin panel
│   │       ├── products/      # Product management
│   │       ├── orders/        # Order management
│   │       ├── inventory/     # Inventory tracking
│   │       ├── categories/    # Category management
│   │       ├── filters/       # Custom filter management
│   │       └── sections/      # Promotional sections
│   └── actions/               # Server Actions (API layer)
│       ├── auth.ts
│       ├── products.ts
│       ├── cart.ts
│       ├── order.ts
│       ├── categories.ts
│       ├── custom-filters.ts
│       ├── admin-products.ts
│       └── admin-orders.ts
├── components/
│   ├── ui/                    # Reusable UI components
│   └── admin/                 # Admin-specific components
├── lib/
│   ├── db.ts                  # Neo4j driver & connection
│   ├── auth.ts                # JWT & password utilities
│   ├── minio.ts               # MinIO client & file operations
│   ├── schema.ts              # Database schema initialization
│   ├── types.ts               # TypeScript type definitions
│   ├── guest-cart.ts          # Guest shopping cart logic
│   └── repositories/          # Data access layer
│       ├── user.repository.ts
│       ├── product.repository.ts
│       ├── category.repository.ts
│       ├── custom-filter.repository.ts
│       ├── cart.repository.ts
│       ├── order.repository.ts
│       ├── promotional-category.repository.ts
│       ├── user-profile.repository.ts
│       ├── browsing-history.repository.ts
│       └── recommendation.repository.ts
├── i18n/
│   └── request.ts             # i18n configuration
├── middleware.ts              # next-intl locale handling
└── messages/
    ├── en.json                # English translations
    └── si.json                # Sinhala translations
```

## Database Architecture

### Neo4j Graph Model

Ecom uses Neo4j to model complex relationships between users, products, orders, and preferences.

**Key Node Types:**
- `User` - Customers and admins
- `Product` - Product information (brand, price, SKU)
- `ProductVariant` - Size/color variants with stock
- `Order` - Order records
- `Category` - Single-parent category hierarchy (Ladies/Gents/Kids)
- `CustomFilter` - Multi-parent filter system for product discovery
- `PromotionalCategory` - Time-limited promotional collections

**Important Relationships:**
- `(ProductVariant)-[:VARIANT_OF]->(Product)` - Variant belongs to product
- `(User)-[:HAS_CART_ITEM]->(ProductVariant)` - Shopping cart
- `(Order)-[:CONTAINS]->(ProductVariant)` - Order items
- `(Product)-[:TAGGED_WITH]->(CustomFilter)` - Products linked to filters
- `(CustomFilter)-[:CHILD_OF]->(CustomFilter)` - Multi-parent filter hierarchy
- `(Category)-[:CHILD_OF]->(Category)` - Single-parent category tree

**Schema Management:**
- Constraints ensure uniqueness (emails, SKUs, order numbers)
- Indexes optimize queries (categories, brands, prices)
- All managed in `src/lib/schema.ts`

### Category vs. Filter System

**Categories (Single-Parent Hierarchy):**
- Each category has exactly ONE parent
- Three root hierarchies: Ladies, Gents, Kids
- Structure: Root (L0) → Clothing/Footwear (L1) → Tops/Bottoms (L2) → Shirts/Blouses (L3)
- Products SHOULD be assigned to leaf categories only
- Located in: `src/lib/repositories/category.repository.ts`

**Custom Filters (Multi-Parent Graph):**
- Filters can have MULTIPLE parents
- Flexible tagging system for product discovery
- Cycle prevention automatically enforced
- Products linked via `TAGGED_WITH` relationship
- Enables complex filtering (e.g., "Summer" + "Casual" + "Red")
- Located in: `src/lib/repositories/custom-filter.repository.ts`

**IMPORTANT:** The legacy `Product.category` field is DEPRECATED. Use the filter system (`TAGGED_WITH` relationships) instead.

## Key Implementation Patterns

### Repository Pattern
All database operations are encapsulated in repository files under `src/lib/repositories/`. Each repository provides a clean API for a specific domain entity.

**Example:**
```typescript
// src/lib/repositories/product.repository.ts
export async function getAllProducts(filters?: ProductFilters): Promise<ProductWithVariants[]>
export async function getProductById(id: string): Promise<ProductWithVariants | null>
export async function createProduct(input: CreateProductInput): Promise<Product>
```

### Server Actions
Next.js Server Actions in `src/app/actions/` provide the API layer. They:
- Handle authentication/authorization
- Call repository functions
- Return standardized `ActionResponse<T>` objects
- Run on the server with direct database access

### Authentication Flow
1. JWT tokens stored in httpOnly cookies (security best practice)
2. `getCurrentUser()` from `src/lib/auth.ts` retrieves current user
3. Password requirements: min 8 chars, 1 uppercase, 1 number
4. Role-based access: `CUSTOMER` or `ADMIN`

### Image Upload Flow
1. Images uploaded through Server Actions (`src/app/actions/upload.ts`)
2. Automatically converted to WebP format for optimization (via Sharp)
3. Stored in MinIO with public read access
4. URLs returned: `http://localhost:9000/product-images/{timestamp}-{filename}.webp`

### Internationalization (i18n)
- All routes prefixed with locale: `/en/shop`, `/si/shop`
- Middleware handles locale detection (`src/middleware.ts`)
- Translations in `messages/en.json` and `messages/si.json`
- Use `useTranslations()` hook in client components
- Server components: import translations via `getTranslations()`

### Client/Server Component Pattern
- Server components: `page.tsx` files (fetch data, handle auth)
- Client components: `*Client.tsx` files (interactivity, state)
- This pattern enables server-side data fetching with client-side interactivity

## Important Considerations

### TypeScript Build Configuration
- Next.js config temporarily disables type checking during build (`next.config.ts:6`)
- This is a workaround for React 19 compatibility issues
- Always run `npm run lint` before committing to catch type errors

### Neo4j Integer Handling
Neo4j returns integers as objects with `low` and `high` properties. The `convertNeo4jIntegers()` utility in `category.repository.ts` handles conversion to JavaScript numbers. Use this pattern when working with Neo4j integers.

### Filter System Cycle Prevention
When updating filter parent relationships, cycles must be prevented. The `custom-filter.repository.ts` includes validation to ensure no filter can become an ancestor of itself.

### Image Optimization
All uploaded images are automatically converted to WebP format (except SVGs) for optimal performance. Original formats are not preserved. Ensure clients understand this behavior.

### Guest Cart vs. User Cart
- Guest carts stored in localStorage (`src/lib/guest-cart.ts`)
- User carts stored in Neo4j via `HAS_CART_ITEM` relationships
- Cart migration happens on login (guest cart → user cart)

## Development Workflow

### Fresh Database Setup

When starting from scratch or after clearing the database:

```bash
# 1. Initialize schema (constraints & indexes)
npm run db:init

# 2. Seed default test users
npm run db:seed

# 3. Setup category hierarchy (optional but recommended)
npm run setup:categories

# 4. Initialize MinIO bucket (if not already done)
npm run minio:init
```

**Important:** Always run `npm run db:seed` after `db:init` or `db:clear` to create the default admin and customer test accounts. Without this, you won't be able to login to the admin panel.

### Making Database Changes
1. Update schema in `src/lib/schema.ts`
2. Run `npm run db:init` to apply constraints/indexes
3. Update relevant repository in `src/lib/repositories/`
4. Update Server Actions in `src/app/actions/`
5. Update TypeScript types in `src/lib/types.ts`

### Adding New Features
1. Define types in `src/lib/types.ts`
2. Create repository functions for data access
3. Create Server Actions for business logic
4. Build UI components
5. Integrate with existing pages

### Testing Database Queries
Use `tsx` to run TypeScript files directly:
```bash
tsx scripts/your-test-script.ts
```

### Debugging

**Web Interfaces:**
- Neo4j Browser: http://localhost:7474 (neo4j/ecommerce123)
- MinIO Console: http://localhost:9001 (ecommerce/ecommerce123)

**Direct Database Access:**
```bash
# Neo4j Cypher Shell
docker exec -it softx-ecommerce-neo4j cypher-shell -u neo4j -p ecommerce123

# Quick queries
docker exec softx-ecommerce-neo4j cypher-shell -u neo4j -p ecommerce123 "MATCH (n) RETURN labels(n), count(*)"
docker exec softx-ecommerce-neo4j cypher-shell -u neo4j -p ecommerce123 "MATCH (c:Category) WHERE c.level = 0 RETURN c.name, c.hierarchy"
```

## Environment Variables

Required variables in `.env.local`:

```env
# Neo4j
NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=ecommerce123

# JWT
JWT_SECRET=your-secure-random-string

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=ecommerce
MINIO_SECRET_KEY=ecommerce123
MINIO_BUCKET_NAME=product-images
NEXT_PUBLIC_MINIO_URL=http://localhost:9000

# App
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Common Pitfalls

1. **Forgetting to start Docker services** - Use `./setup.sh start` instead of just `npm run dev`
2. **Forgetting to seed database after init/clear** - Run `npm run db:seed` to create default test users, otherwise you can't login
3. **Using deprecated `Product.category` field** - Use custom filters (`TAGGED_WITH`) instead
4. **Assigning products to non-leaf categories** - Products should only be in leaf categories
5. **Not handling Neo4j integer conversion** - Always convert to JS numbers
6. **Mixing guest and user cart logic** - These are separate systems

## Git Workflow

Current branch: `master`
Recent focus: Glass morphism design system, Next.js 15 compatibility, type safety improvements

Many documentation files (MD files) have been deleted from git. Avoid recreating them unless explicitly requested.

## Related Documentation

- `README.md` - Project overview and quick start
- `STYLE_GUIDE.md` - Design system and component specifications
- `docker-compose.yml` - Service configuration
- `.env.example` - Environment variable template
