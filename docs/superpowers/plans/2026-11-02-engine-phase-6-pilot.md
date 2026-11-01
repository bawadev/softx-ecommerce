# Engine/Contract Separation — Phase 6 (Second-Client Pilot + Provisioning) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove "different UI, same contract" — a minimal second client storefront (`apps/acornbay`) on its OWN tenant (own Neo4j container, own data), plus `scripts/new-client.ts` so onboarding client N+1 is one command, never hand-assembled.

**Architecture:** The pilot app is deliberately visually different (own theme/layout) but consumes exactly `@softx/contract` v1 through `@softx/engine` configured for its tenant — no shared UI code with factorybay beyond the packages. Provisioning creates the Neo4j container (DB-per-client), MinIO bucket prefix on the configured MinIO endpoint (the shared SoftX instance rollout is a tracked infra task — the script takes the endpoint from env), seeds minimal data, and scaffolds the app from a template. Spec §8 Phase 6 + design §6/§7.

**Tech Stack:** unchanged. No new dependencies.

## Global Constraints

- Branch `engine-contract-separation` (post-Phase-5). Commit per task; never push.
- Canonical build env prefix as before; builds must succeed for BOTH apps (`npm run build` builds factorybay; add `build:all`).
- Tests: unit/integration counts continue from Phase 5's final numbers (report them); nothing in Phase 6 may reduce coverage.
- The pilot client id: `acornbay` (used as clientId, Neo4j container name `ecom-acornbay-neo4j`, DB name inside its own container stays the server default — container-per-client, database unset, per the design's community-edition reality).
- MinIO tenancy this phase: bucket prefix `<clientId>-*` on the EXISTING configured MinIO endpoint (per-client principals noted as the infra follow-up when the shared instance lands). Product image URLs flow through DTOs unchanged.
- factorybay MUST remain untouched except build-script additions (its pages/actions/packages frozen this phase).
- scripts/new-client.ts: parameters, not new work — `--client <id> [--port <p>]`; idempotent (safe re-run); prints exactly what it did.

---

### Task 1: App template — `apps/_template` + build wiring

**Files:** Create `apps/_template/` (package.json `@softx/store-template`, tsconfig extending base, next.config, minimal `src/app/[locale]` with layout + 3 pages — home, shop, product/[id] — using a DISTINCT default theme (dark, different fonts/layout; no tailwind config copied verbatim — minimal CSS), `src/lib/engine.ts` (createEngine from env: NEO4J_URI/USER/PASSWORD, CLIENT_ID env), messages/en only). Modify root `package.json` (+`build:all` running `npm run build -w factorybay && -w acornbay` after Task 2 copies), Dockerfile untouched (deploys factorybay only — template app not in image; NOTE in Dockerfile comment), `.gitignore` (template's .next covered by existing apps/* rules).

Template pages consume the engine directly: home = `catalog.listHeroSlides()` + `catalog.listNewArrivals(8)`; shop = `catalog.listProducts()` grid; PDP = `catalog.getProduct(id)` with `amount(price.stock)` display (own `src/lib/price.ts` — a deliberate 5-line copy, different app). No cart/login this phase (catalog-only pilot — documented). Server actions not required (server components call the service directly — the app is a server-rendered consumer of the embedded engine; this is the "different UI" proof). Commit `feat: storefront app template (minimal contract-only client)`.

### Task 2: `scripts/new-client.ts` + provision acornbay

**Files:** Create `scripts/new-client.ts` (repo root scripts/, tsx-run via `npm run new-client -- --client acornbay`), root package.json script. The script: (1) validates id (kebab); (2) `docker run -d --name ecom-<id>-neo4j -e NEO4J_AUTH=neo4j/<generated-or-env password> -p <auto-or-given port>:7687 neo4j:latest` (skip if container exists; print the port + creds to .env.local values); (3) MinIO: if MC endpoint env present, `mc mb`/ignore-exists for `<id>-media` (else print the manual step — MinIO never blocks provisioning); (4) copy `apps/_template` → `apps/<id>`, rewrite package name + CLIENT_ID + Neo4j port into `.env.local.example`, `npm install` (workspace link); (5) seed: run a minimal cypher seed (3 products with variants, 2 hero slides — a committed `scripts/seed-client.cypher` template with the client's prices) via cypher-shell in the new container; (6) print summary (URLs, ports, next steps). Then RUN it for `acornbay`, commit template + script + the generated `apps/acornbay` (minus .env.local) + `docker-compose.acornbay.yml` (a compose file for the container so `docker compose -f` manages it) — the generated app IS committed (it's the pilot deliverable). Commit `feat: new-client provisioning + acornbay pilot app provisioned`.

### Task 3: Pilot verification — build, run, tenant isolation

**Files:** Create `apps/acornbay/e2e/pilot.spec.ts` (Playwright config copied minimal — port from env; 2 tests: shop lists acornbay's seeded products; PDP renders price). Steps: `npm run build -w acornbay` green; start its dev server against ITS container; run the 2 pilot specs green; ISOLATION PROOF: assert acornbay's shop shows ONLY acornbay products (seed distinct names like 'Acorn Hoodie') while factorybay's local dev shop (its own compose neo4j) shows none of them (run factorybay dev + 1 curl assertion, or a targeted catalog query via a tiny tsx script against both URIs — script preferred, document output in the report). Update `build:all`; root build matrix green. Commit `test: acornbay pilot green + tenant isolation proof`.

### Task 4: Docs + CLAUDE.md + final matrix

CLAUDE.md: "Multi-client" section — new-client onboarding = `npm run new-client -- --client <id>`, tenant model (container-per-client, bucket prefix), template description, factorybay/acornbay list. README short section. Full matrix: factorybay unit/integration/smoke unchanged-green, acornbay build + pilot specs green, `npm run build` (factorybay) + `build:all` green, audit gate clean. Commit `docs: Phase 6 — multi-client onboarding + pilot`.

---

## Definition of Done (Phase 6)
- [ ] `apps/_template` exists (minimal contract-only storefront); root builds both apps
- [ ] `npm run new-client -- --client <id>` provisions container + buckets-prefix + app + seed, idempotently
- [ ] `apps/acornbay` live-green: build + 2 pilot specs + TENANT ISOLATION proof (disjoint product sets)
- [ ] factorybay untouched (all its matrices unchanged)
- [ ] Docs cover onboarding; full matrix green
