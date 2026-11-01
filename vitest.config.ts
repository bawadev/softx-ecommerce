import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
    // Integration test files share one live Neo4j conformance world and each
    // tears it down in afterAll — running them concurrently lets one file's
    // teardown delete the other's seeded data mid-run. Serialize files under
    // RUN_INTEGRATION=1; plain `npm test` keeps vitest's default parallelism.
    fileParallelism: process.env.RUN_INTEGRATION !== '1',
  },
})
