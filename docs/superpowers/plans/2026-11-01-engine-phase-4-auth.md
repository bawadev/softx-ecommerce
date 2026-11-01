# Engine/Contract Separation — Phase 4 (Auth/Profile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the account domain behind `AccountService` + `ProfileService` v1 (signup with server-side hashing/duplicate-check, credential verification, profile reads/writes, recently-viewed/recommendations as ProductDTOs), with JWT/cookies staying app-side per the design ("JWT unchanged"), and retire the app-side `lib/product-dto.ts` adapter.

**Architecture:** Same pattern as Phases 1–3. Credential hashing moves INTO the engine (bcryptjs dependency moves with the code); the app keeps only token minting/cookie handling (`lib/auth.ts` JWT helpers untouched). Browsing/recommendation reads stop being app adapters over raw repositories and become engine methods returning contract DTOs. The Actor concept stays deferred to Phase 5 (where admin services consume roles) — YAGNI now. Spec: `docs/superpowers/specs/2026-10-31-engine-contract-separation-design.md` §8 Phase 4.

**Tech Stack:** TypeScript strict, zod, bcryptjs (moving to engine), vitest, Playwright. No new dependencies beyond moving bcryptjs into `packages/engine`.

## Global Constraints

- Branch `engine-contract-separation`, HEAD `af7b333` + merge `286abf1` lineage. Commit per task; **never push**.
- Canonical build: `JWT_SECRET=build-time-placeholder NEO4J_PASSWORD=dummy MINIO_ACCESS_KEY=dummy MINIO_SECRET_KEY=dummy MINIO_BUCKET_NAME=product-images MINIO_USE_SSL=false npm run build`.
- Tests now: `npm test` = 51 passed / 26 skipped; integration = `NEO4J_PASSWORD=ecommerce123 npm run test:integration` → 26 (needs `docker compose up -d neo4j`; NEVER minio).
- Every contract method returns `Result<T, DomainError>`; codes from the fixed union. Parity for error mapping: duplicate email → `CONFLICT` (app renders 'An account with this email already exists'); bad credentials / wrong password → `UNAUTHORIZED`; invalid email/password shape → `VALIDATION` with today's exact message strings.
- **Password hashes never leave the engine**: `AccountDTO` has no password field; `authenticate` returns the account, not the hash. App keeps `generateToken`/`setAuthCookie` (JWT + cookies = transport, app-side).
- Password rules parity (`apps/factorybay/src/lib/auth.ts:130`): read `validatePassword` and port its EXACT rules + message strings into the engine's validation (email via the same `isValidEmail` regex shape).
- Contract additions additive; snapshot regen in-task; `git diff --exit-code -- packages/contract/etc` clean after.
- Action names + envelope keys unchanged; `logoutAction`, `lib/auth.ts` token/cookie helpers, and admin user actions (`admin.ts`) untouched.
- Profile product lists return `v1.ProductDTO[]` (same DTO the catalog service emits — one mapper, `packages/engine/src/mappers/catalog.mapper.ts`, reused).

---

### Task 1: Contract — AccountDTO, commands, AccountService + ProfileService

**Files:**
- Create: `packages/contract/src/v1/account/account.dto.ts`, `packages/contract/src/v1/account/account.service.ts`
- Modify: `packages/contract/src/v1/index.ts`
- Test: `packages/contract/src/v1/account/account.dto.test.ts`

**Interfaces (under `v1`):**
- `UserRoleSchema = z.enum(['CUSTOMER','ADMIN'])`; `AccountDTO = { id, email, role, firstName, lastName, phone?, createdAt, updatedAt }` (mirrors engine `User` minus passwordHash); `SignUpCommand = { email, password, firstName, lastName, phone?, role? }` (role optional, default CUSTOMER — engine enforces); `Credentials = { email, password }`
- `UserPreferencesDTO = { preferredBrands: string[], preferredColors: string[], preferredCategories: string[], priceRange: { min: number, max: number } }` (mirror engine `UserPreference` minus ids/userId — read `user-profile.repository.ts` first and adapt); `UserMeasurementsDTO` likewise (mirror `UserMeasurements` minus ids/userId)
- `AccountService`: `signUp(command): Promise<Result<AccountDTO>>` · `authenticate(credentials): Promise<Result<AccountDTO>>` · `getProfile(userId): Promise<Result<AccountDTO>>`
- `ProfileService`: `getPreferences(userId): Promise<Result<UserPreferencesDTO>>` · `updatePreferences(userId, prefs): Promise<Result<UserPreferencesDTO>>` · `getMeasurements(userId): Promise<Result<UserMeasurementsDTO>>` · `updateMeasurements(userId, m): Promise<Result<UserMeasurementsDTO>>` · `trackProductView(userId, productId): Promise<Result<null>>` · `listRecentlyViewed(userId, limit?): Promise<Result<ProductDTO[]>>` · `listRecommendations(userId, limit?): Promise<Result<ProductDTO[]>>` · `listSimilarProducts(productId, limit?): Promise<Result<ProductDTO[]>>`

**Steps:**
- [ ] **Verification duty first:** read `packages/engine/src/repositories/user-profile.repository.ts` + `types.ts` (`UserPreference`, `UserMeasurements`, incl. `MeasurementUnit`) — adapt the two profile DTOs to the REAL shapes (include unit fields where the type has them); record findings.
- [ ] **Failing tests** (zod): AccountDTO rejects `passwordHash` presence is fine (stripped) — assert parse strips unknown keys; SignUpCommand rejects empty password; Credentials requires both fields; enum rejects 'SUPERUSER'. Write them first, run `npm test` → FAIL.
- [ ] **Implement** the two dto/service files + v1 index exports (`export * from './account/account.dto'` + `./account/account.service'`).
- [ ] `npm test` → 51 + 4 = 55 passed / 26 skipped; `npm run audit:api` → additions-only diff; commit `feat(contract): v1 account+profile DTOs, AccountService, ProfileService`.

---

### Task 2: Account + profile conformance suites

**Files:**
- Create: `packages/contract/src/testing/account-world.ts`, `packages/contract/src/testing/account-conformance.ts`
- Modify: `packages/contract/src/testing/index.ts`

**Interfaces:**
- `accountWorld = { user: { id: 'conformance-acct-user', email: 'conformance-acct@example.com', firstName: 'Conformance', lastName: 'Account' }, seedCypher, teardownCypher }` — seeds a `:User` with a KNOWN bcrypt hash (generate at module load: `bcrypt.hashSync('Conformance123!', 10)` — bcryptjs is a contract-package dependency after Task 1? NO: generate the hash lazily in the RUNNER, not the world; keep the world hash-free: seedCypher is a function `seedCypher(passwordHash: string)` returning the Cypher). Teardown: `MATCH (n) WHERE n.id = 'conformance-acct-user' OR (n:User AND n.email STARTS WITH 'conformance-acct-') DETACH DELETE n` (signup tests create accounts with such emails).
- `runAccountConformance(suiteName, makeService: () => v1.AccountService & v1.ProfileService & v1.CatalogService)` — the account runner also needs catalog (listSimilarProducts) and profile.

**Suite blocks (write exact assertions):**
1. `authenticate` with the seeded email + 'Conformance123!' → ok, AccountDTO parses, NO password/hash field.
2. Wrong password → `UNAUTHORIZED`; unknown email → `UNAUTHORIZED`.
3. `signUp` new email (conformance-acct-new@example.com / 'NewPass123!') → ok, role CUSTOMER, email matches; second signUp same email → `CONFLICT`; invalid email → `VALIDATION`; weak password → `VALIDATION` with the parity message.
4. `getProfile(seeded id)` → ok, email matches; `getProfile('nobody')` → `NOT_FOUND`.
5. Preferences round-trip: getPreferences → defaults shape (or empty arrays — mirror repo reality), updatePreferences({brands:['Acme'],...}) → ok and getPreferences reflects it.
6. Measurements round-trip likewise (only if the repo supports upsert the same way — verification duty; if measurements are per-user singletons, same pattern).
7. `trackProductView(seeded, 'conformance-p1')` then `listRecentlyViewed` → contains conformance-p1 (ORDER: check repo ordering — newest first; assert contains, not exact order, to stay implementation-honest); `listRecommendations('nobody…')`? — recommendations for a user with history seeded only via trackProductView: assert returns an ARRAY (shape honesty; engine may legitimately return [] or products — check repo semantics during Task 3 verification and pin the MINIMUM: `Array.isArray` + every entry parses as ProductDTO).
8. `listSimilarProducts('conformance-p1')` → every entry parses as ProductDTO (may be empty — pin parse-only).

Unwired (Tasks 4/5 wire). tsc contract clean. Commit `feat(contract): account+profile conformance suites and world`.

---

### Task 3: Engine — user/user-profile/recommendation/browsing threading + services

**Files:**
- Create: `packages/engine/src/account.ts`, `packages/engine/src/profile.ts`
- Modify: `packages/engine/src/repositories/user.repository.ts`, `user-profile.repository.ts`, `recommendation.repository.ts`, `browsing-history.repository.ts` (database threading, established pattern), `packages/engine/src/engine.ts` (`TenantEngine.account`, `TenantEngine.profile`), `packages/engine/package.json` (+`bcryptjs` dep, same version range as the app's; app KEEPS its dep too this phase — lib/auth.ts verifyPassword still used by... check: if nothing app-side hashes after the switch, the app dep can drop in Phase 5)
- Test: `packages/engine/src/account.test.ts` (validation-rule unit tests, hermetic: email/password validators with exact parity messages)

**Key implementation facts:**
- Port `isValidEmail` + `validatePassword` from `apps/factorybay/src/lib/auth.ts` into `account.ts` (exact regex + message strings — the unit test pins them against the app file's current content at write time).
- `signUp`: VALIDATION (email/password rules) → `emailExists` → CONFLICT → `bcrypt.hash` → `createUser` (repo signature verification duty) → map to AccountDTO. `authenticate`: findUserByEmail → null → UNAUTHORIZED ('Invalid email or password' — parity message with today's login flow; check `loginAction`), `bcrypt.compare` → false → UNAUTHORIZED, else AccountDTO. `getProfile`: findUserById → NOT_FOUND.
- `profile.ts`: preferences/measurements over the threaded repos (map dropping ids/userId — verification duty on real repo shapes/return envelopes, e.g. getPreferences may return null for new users: default to the DTO's empty shape per repo semantics); trackProductView/listRecentlyViewed/listRecommendations/listSimilarProducts over threaded browsing/recommendation repos, mapping rows with the EXISTING `toProductDTO` mapper (they return ProductWithVariants-shaped rows — verify; where a repo returns raw records, run `convertNeo4jIntegers` first like the catalog mapper does).
- Threading: optional `database?: string` last param everywhere, internal delegations forward.
- Tests: `npm test` 55 + N (account unit tests) passed; tsc engine clean; canonical build; integration still 26 (nothing wired yet). Commit `feat(engine): AccountService + ProfileService; auth repositories threaded; bcryptjs in engine`.

---

### Task 4: engine-fixtures — fake account + profile

**Files:**
- Create: `packages/engine-fixtures/src/fake-account.ts` (covers BOTH services: in-memory users map — the fake hash is the literal `fake:<password>` marker compared by equality, semantics-equivalent to bcrypt verify for the suite; preferences/measurements maps; recently-viewed array per user seeded empty)
- Create: `packages/engine-fixtures/src/fake-account.conformance.test.ts`
- Modify: `fake-engine.ts` (expose `account`, `profile` — shared per-for() instance)

Fake semantics mirror the engine exactly: same VALIDATION messages (import nothing from engine — duplicate the strings with a parity comment), CONFLICT on duplicate, UNAUTHORIZED on bad credentials, NOT_FOUND profile, ProductDTO lists from `worldProducts` (recently-viewed after track returns that product). After wiring: `npm test` = 55 + 8 (suite blocks that are `it`s — count the actual blocks written in Task 2) passed / 26 skipped. Commit `feat(engine-fixtures): fake account+profile services passing conformance`.

---

### Task 5: Real-engine integration (account + profile)

**Files:**
- Create: `packages/engine/test/account.integration.test.ts`

Structure per the order integration file (skip gate, driver, catalog seed — account world seed takes a runtime bcrypt hash via the function-form seedCypher; pre/post teardown includes accountWorld.teardownCypher AND removes `conformance-acct-*` users; the fake-signup users created by the suite). Runner: `runAccountConformance('real-engine', () => { const t = engine.for({clientId:'conformance'}); return { ...t.account, ...t.profile, ...t.catalog } })`. After: integration = 26 + (suite count) — expect **~34**; `npm test` unchanged-passed/skipped grows accordingly; DB verified clean (0 conformance users/preferences/history). Commit `test(engine): real-engine account+profile conformance run`.

---

### Task 6: App switch — auth actions, profile actions, kill product-dto adapter

**Files:**
- Modify: `apps/factorybay/src/lib/engine.ts` (+`getAccountService()`, `getProfileService()`), `apps/factorybay/src/app/actions/auth.ts` (signupAction/loginAction → services; token/cookie + guest-merge logic stays; logoutAction untouched), `apps/factorybay/src/app/actions/user-profile.ts` (all 7 actions → ProfileService wrappers, envelopes preserved)
- Delete: `apps/factorybay/src/lib/product-dto.ts` (its only consumers move to engine-returned ProductDTOs — verify with grep first; any remaining consumer re-points to the service)
- Modify (types only where needed): `apps/factorybay/src/app/[locale]/profile/ProfileClient.tsx`, homepage recently-viewed/recommendations consumers — verify shapes match (they already consumed DTOs via the adapter, so expect minimal/no diffs; enumerate with grep `getRecentlyViewedProductsAction|getPersonalizedRecommendationsAction|getSimilarProductsAction`)

**Action mapping (envelopes preserved):** signupAction → `signUp` (map CONFLICT→'An account with this email already exists', VALIDATION→r.error.message — the parity strings live in the engine now); loginAction → `authenticate` (UNAUTHORIZED→today's message — check `loginAction`'s current string; then token+cookie+guest-merge as today); user-profile actions → direct wrappers (trackProductView returns `{success:true}` envelope as today).

**Verify:** canonical build; `npm test`; integration; greps — `bcrypt` gone from `apps/factorybay/src/app/actions/auth.ts` (lib/auth.ts keeps hashPassword? grep its remaining callers: if ONLY signup/login hashed, lib/auth.ts keeps just token/cookie/validation exports — leave the file, dead exports are Phase 5 cleanup); `product-dto.ts` deleted with zero importers. Commit `feat(app): auth+profile on AccountService/ProfileService; product-dto adapter retired`.

---

### Task 7: Smoke (signup journey) + docs + final verification

**Files:**
- Create: `apps/factorybay/e2e/signup.spec.ts`; Modify: `CLAUDE.md`

Journey: signup with a timestamped email (`smoke+<ts>@example.com` / 'Smoke123!') → expect login-redirect/signed-in nav → profile page reachable (`/en/profile`) → recently-viewed: visit the SMOKE product PDP (as the new user) then `/en/profile` shows it in recently viewed (verify ProfileClient actually renders recently-viewed — verification duty; if it doesn't, assert the profile page renders the account name instead and note it). Header documents the per-run account residue. Final matrix: smoke 5; integration (Task 5 count); `npm test`; build; `audit:api` clean. CLAUDE.md engine paragraph gains the Phase 4 sentence. Commit `test(app): signup smoke journey + Phase 4 docs`.

---

## Definition of Done (Phase 4)

- [ ] Contract v1 additive: AccountDTO/commands + AccountService (3) + ProfileService (8); snapshot gate green
- [ ] Account/profile conformance on fixtures AND real engine; DB clean after
- [ ] Engine owns hashing + credential verification; hashes never in DTOs; validation messages exact parity
- [ ] auth/user-profile actions are wrappers; JWT/cookies untouched; product-dto adapter deleted
- [ ] Signup smoke journey green; full matrix green
