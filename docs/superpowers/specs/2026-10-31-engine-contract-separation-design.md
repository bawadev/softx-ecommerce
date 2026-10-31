# softx-ecommerce: Engine/UI Separation with a Versioned Contract

**Date:** 2026-10-31
**Status:** Approved design — pre-implementation
**Repo:** `bawadev/softx-ecommerce` (Factory Bay)

## 1. Problem

The platform is a single Next.js 15 app (`apps`-less, `src/` flat) in which UI and functionality are fused: pages under `src/app/[locale]/**` call 15 server-action modules (~3,300 lines) directly, 7 components import actions, and repository types (`ProductWithVariants`) leak from Neo4j into JSX. There is no contract between UI and functionality, so:

- every new client (separate business) means forking the whole app;
- functionality cannot evolve without dragging every UI along;
- nothing guarantees an older UI still works against newer functionality.

## 2. Goals

1. Separate UI from functionality: an **engine** (functionality) consumed by arbitrary **client UIs** through a **contract**.
2. Multiple client UIs — different businesses — on the same contract.
3. A contract with **explicit backward compatibility**: evolving engine, old UIs keep working.

### Non-goals

- HTTP/API façade (contract is server-side TypeScript in a monorepo; façade can be generated later).
- Checkout/payment modernization (wrapped as-is in contract v1).
- Shared UI kit across apps (per-app UI is the point; a tokens package may come later).
- Multi-tenant *shared* database.

## 3. Locked decisions

| Question | Decision |
|---|---|
| What is a "client"? | Separate businesses — SaaS, each with its own storefront (and admin) UI |
| How do UIs reach the engine? | Monorepo SDK, engine embedded per app — no HTTP hop |
| Data isolation | DB-per-client (one Neo4j container per client — community edition is single-DB) |
| Contract clients | Storefront **and** admin |
| Backward compatibility | Semver majors living side-by-side + engine adapters; CI conformance tests per live major |
| Media storage | New shared SoftX MinIO (suwacare-style), per-client buckets + scoped principals (MC-925 pattern) |

## 4. Monorepo layout

Convert the repo **in place** to npm workspaces (git history and Jenkins stay attached):

```
softx-ecommerce/
├── apps/
│   ├── factorybay/          # existing Next.js app (storefront + admin), becomes a contract client
│   └── <client-b>/          # each new business: own app, own deploy, own UI
├── packages/
│   ├── contract/            # @softx/contract — service interfaces + DTOs + zod schemas, semver'd
│   ├── engine/              # @softx/engine — implements contract; absorbs src/lib/repositories
│   └── engine-fixtures/     # fake engine implementing the contract (UI dev without infra)
└── package.json             # workspaces: apps/*, packages/*
```

Each app is a deployment unit embedding the engine. **Server actions remain in each app** as thin wrappers (`'use server'` → `engine.for(tenant).catalog.…`), preserving the only client-callable boundary; the 7 components importing actions today keep working throughout migration.

## 5. The contract (`@softx/contract`)

**Services:** `CatalogService`, `CartService`, `CheckoutService`, `OrderService`, `MediaService`, `AccountService`, `AdminCatalogService`, `AdminOrderService`.

**DTOs:** zod schemas + inferred types defined in the contract package only. Repository types never appear in a DTO. Money is `{ amountMinor: number, currency: string }` (prices are bare numbers today).

**Results:** every method returns `Result<T, DomainError>`; error **codes are stable and part of the contract** (replaces ad-hoc `{ success, data }` shapes).

**Actor & i18n:** the engine receives an `Actor` (anonymous / customer / admin) via context, not per-method parameters. The contract carries codes/params, never translated strings — next-intl stays per-app.

**Versioning & compatibility mechanics:**

- Majors live side-by-side as namespaces: `import { v1, v2 } from '@softx/contract'`. v1 = today's behavior, extracted.
- Breaking changes only in a new major. Deprecations in vN carry `@deprecated` + sunset date and are removed only in vN+1.
- The engine implements the newest major; adapter modules map older majors onto it (`packages/engine/adapters/v1.ts`).
- **CI gates:** (a) type-snapshot diff (api-extractor) on the package exports — a minor release may only *add*; (b) a **conformance suite** (fixtures → per-method assertions, including error codes) run against the engine for **every live major** — a UI pinned to v1 provably keeps working while the engine evolves.

## 6. The engine + tenancy

```
const engine = createEngine(config)        // Neo4j endpoints, MinIO endpoint+resolver, feature flags
const tenant = engine.for(clientId, actor) // binds TenantContext
await tenant.catalog.listProducts(query)   // services hang off the bound engine
```

- **TenantContext** maps `{ clientId → its Neo4j container, its bucket set, its scoped MinIO principal }`.
- **Neo4j reality:** community edition runs one database per container → DB-per-client means one Neo4j container per client (mirrors the suwacare accessory pattern). Each client app deployment is configured for exactly one tenant; the engine stays multi-tenant-capable for future tooling.
- The 11 existing repositories move into `packages/engine`, parameterized by tenant.

## 7. Storage tenancy (new shared SoftX MinIO)

- New shared MinIO instance, suwacare-style: no published ports, presigned URLs only, served through Traefik.
- **Per client:** buckets `<clientId>-*` and a bucket-scoped service-account principal `<clientId>-engine-rw` (MC-925 pattern — root credentials never leave the instance; wildcard policy per client bucket set).
- The engine's `MediaService` presigns uploads/downloads; **DTOs expose final public URLs only** — bucket names never reach a UI.
- Existing 42 objects in `ecommerce-minio`/`product-images` are `mc mirror`ed into `factorybay-*`.

## 8. Migration (strangler, 6 phases)

Each phase follows the same loop: **define the contract slice → conformance tests (fixtures + real engine) → implement in engine → switch UI behind action-wrappers → delete old action internals.**

- **Phase 0 — baseline + monorepo.** `git pull` (master is 6 behind origin), resolve the stray deleted `.playwright-mcp` key file, convert to workspaces, move app to `apps/factorybay/`, adjust Dockerfile/Jenkins build context so the deployed artifact is unchanged. No behavior change.
- **Phase 1 — catalog** (products, categories, promotional categories, hero slides): biggest, read-mostly surface — shakes out the pattern.
- **Phase 2 — cart** (guest-cart + zustand store) → `CartService`.
- **Phase 3 — checkout, orders, payment** → `CheckoutService` / `OrderService` (logic wrapped as-is).
- **Phase 4 — auth, profile** → `AccountService` (JWT unchanged; feeds `Actor`).
- **Phase 5 — admin actions** → `AdminCatalogService` / `AdminOrderService`.
- **Phase 6 — second client pilot.** A minimal second UI against the same contract proves "different UI, same contract" end-to-end. Forces scripted onboarding: `scripts/new-client.ts` provisions the Neo4j container, `<client>-*` buckets + principal, and scaffolds the app. Client onboarding is scripted, never hand-assembled.

Implementation planning targets **Phases 0–1 first**; later phases get their own plans once the pattern is proven in production.

## 9. Testing & CI

- **Conformance suite** runs against every live contract major on every PR (Jenkins; existing `docker compose` Neo4j + MinIO as backend).
- **Type-snapshot gate** on `@softx/contract`: additive-only minors, breaking requires a new major.
- **`engine-fixtures`**: any client UI develops against a fake engine with zero infrastructure.
- **Playwright smoke** per app on the four golden journeys (browse → PDP → cart → checkout) — certifies "old UI on new engine major".

## 10. Risks & accepted trade-offs

| Risk | Stance |
|---|---|
| Neo4j container-per-client ≈ 0.5–1 GB RAM each | Acceptable at current client count; revisit at 10+ clients |
| Contract is TypeScript-bound | Accepted (monorepo decision); HTTP façade can be generated later |
| Checkout/payment wrapped as-is in v1 | Deliberate; modernization waits for a v2 decision |
| Deprecation discipline can rot | Mitigated by the type-snapshot gate + sunset dates in `@deprecated` |
| Cart lives partly client-side (zustand) | CartService defines server truth; store becomes a projection |

## 11. Out-of-scope follow-ups (parked)

- Route-handler/HTTP façade over the contract (third-party UIs).
- Storefront-API-shaped contract variant (Approach 2 from brainstorming).
- Cross-client features (shared catalogs, global admin).
