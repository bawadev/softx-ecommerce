export const packageName = '@softx/contract'

export * as v1 from './v1'

// NOTE: do NOT re-export `./testing` from this root barrel. The testing module
// imports `vitest`, and this root is evaluated by app runtimes (Next.js
// dev/prod via @softx/engine) — importing vitest outside a Vitest run throws
// "Vitest failed to access its internal state" and 500s every catalog page.
// Test helpers are public via the `@softx/contract/testing` subpath export
// (see package.json "exports").
