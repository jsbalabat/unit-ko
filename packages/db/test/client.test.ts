import { describe, expect, it } from "vitest";
import { withRollback } from "./helpers/client";

// Proves the harness itself before any logic is tested: a live connection, and
// that writes made inside withRollback() are gone once it returns. The auth.users
// insert here is the same one seedLandlord() relies on, so this also validates
// the fixture's core insert.
describe("integration harness", () => {
  it("connects to the database", async () => {
    const ok = await withRollback(async (tx) => {
      const { rows } = await tx.query<{ ok: number }>("select 1 as ok");
      return rows[0].ok;
    });
    expect(ok).toBe(1);
  });

  it("rolls back writes so nothing leaks between tests", async () => {
    const email = `smoke-${Date.now()}@test.local`;

    await withRollback(async (tx) => {
      await tx.query(
        `insert into auth.users (id, email) values (gen_random_uuid(), $1)`,
        [email],
      );
      const { rows } = await tx.query<{ n: number }>(
        `select count(*)::int as n from auth.users where email = $1`,
        [email],
      );
      expect(rows[0].n).toBe(1);
    });

    // A fresh transaction must not see the rolled-back row.
    await withRollback(async (tx) => {
      const { rows } = await tx.query<{ n: number }>(
        `select count(*)::int as n from auth.users where email = $1`,
        [email],
      );
      expect(rows[0].n).toBe(0);
    });
  });
});
