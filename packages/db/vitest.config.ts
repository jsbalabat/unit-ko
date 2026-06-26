import { defineConfig } from "vitest/config";

// These suites talk to a live local Supabase Postgres (see test/helpers/client.ts),
// so they are deliberately NOT exposed under a `test` script: turbo's `test` task
// would then run them in environments with no database. Invoke explicitly with
// `pnpm --filter @unitko/db test:db` after `db:start` + `db:reset`.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/helpers/setup.ts"],
    // A round-trip to Postgres plus fixture seeding is slower than a pure unit
    // test; give each test and hook headroom over the default 5s.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
