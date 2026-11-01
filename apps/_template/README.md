# Storefront app template (`apps/_template`)

The starting point for every SoftX client storefront: a **minimal, contract-only
client** that proves "different UI, same contract". It renders a dark, minimal
catalog (home / shop / product pages) entirely from `@softx/contract` v1 DTOs
served by an embedded `@softx/engine` bound to the app's own tenant.

It is NOT a runnable workspace app on its own — see "Not an npm workspace" below.
Instantiate it with the provisioning script (Phase 6 Task 2):

```bash
npm run new-client -- --client <id>   # copies this template to apps/<id> and wires everything
```

## What's inside

| Path | Purpose |
|---|---|
| `src/app/page.tsx` | Home: `catalog.listHeroSlides(true)` banner + `catalog.listNewArrivals(8)` grid |
| `src/app/shop/page.tsx` | Shop: `catalog.listProducts()` grid |
| `src/app/product/[id]/page.tsx` | PDP: `catalog.getProduct(id)`, price via `amount(price.stock)` |
| `src/lib/engine.ts` | `createEngine(engineConfigFromEnv())` singleton; `getCatalog()` binds `CLIENT_ID` |
| `src/lib/price.ts` | Deliberate 5-line copy of the money helpers (`amount`, `formatPrice`) — each app owns its rendering utils |
| `src/app/globals.css` | The whole theme: dark minimal, serif display + system body, one accent — no Tailwind |

All pages are **server components** that call the engine directly (no server
actions needed for a read-only catalog) and are `force-dynamic` — they read the
tenant's live Neo4j per request, so they must never be prerendered at build time.

## Deliberate scope decisions (per-client choices, not contract requirements)

- **No i18n.** Plain routes at `/` — no `[locale]` segment, no `next-intl`.
  Multi-locale is a per-client choice; the contract's DTOs are locale-neutral
  and do not force an i18n architecture. factorybay shows the multi-locale
  pattern; this template shows the single-locale one.
- **Catalog-only.** No cart, login, or admin in the pilot template. The same
  `engine.for({ clientId })` binding exposes `cart`, `order`, `account`,
  `profile`, `adminCatalog` and `adminOrder` when a client grows.
- **Plain `<img>`** instead of `next/image` (keeps the template free of image
  optimizer config and the `sharp` dependency). Swap per client if desired.
- **Own `price.ts`** rather than a shared UI package — UI code is NOT shared
  between clients beyond `packages/*`; only the contract is.

## Not an npm workspace (important)

The root `package.json` lists workspaces **explicitly** — `apps/factorybay`,
`apps/acornbay`, `packages/*` — so this template directory is never picked up
by the `apps/*` glob. Consequences:

- The template's `package.json` is intentionally **dependency-free**: the
  instantiated app's manifest is written by the provisioning script, which adds
  the real dependency set (`next`, `react`, `react-dom`, `@softx/contract`,
  `@softx/engine`, `typescript`, types, `tsx`, …), rewrites the name to the
  client id, and runs `npm install` to link the workspace packages.
- **When provisioning a new client, the script must also add `apps/<id>` to the
  root workspaces list** — that is what makes the copied app a real workspace.
- The Docker image deploys factorybay only; its deps stage installs exactly the
  manifests it COPYies. Because workspaces are an explicit list, an app that is
  not in the image can never desync the lockfile during `npm ci`.
