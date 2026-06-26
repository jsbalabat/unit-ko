import { describe, expect, it } from "vitest";
import { withRollback } from "./helpers/client";

// The atomic RPCs `revoke execute from public` and grant only to service_role
// (schemas/50_functions.sql) — the security backstop behind the service-role key.
// An end-user role must not be able to execute them. We assert the grant at the
// role level via SET LOCAL ROLE: the same EXECUTE check PostgREST performs after
// switching to the request's role, without needing HTTP or keys.
const END_USER_ROLES = ["anon", "authenticated"];
const ANY_UUID = "00000000-0000-0000-0000-000000000000";

describe("atomic RPC execute grants", () => {
  for (const role of END_USER_ROLES) {
    it(`denies ${role} execute on record_payment_atomic`, async () => {
      await withRollback(async (tx) => {
        await tx.query(`set local role ${role}`);
        await expect(
          tx.query(`select public.record_payment_atomic($1, $2::jsonb)`, [
            ANY_UUID,
            JSON.stringify({ amount: 1 }),
          ]),
        ).rejects.toThrow(/permission denied/i);
      });
    });
  }

  it("denies anon execute on update_billing_entry_atomic", async () => {
    await withRollback(async (tx) => {
      await tx.query(`set local role anon`);
      await expect(
        tx.query(`select public.update_billing_entry_atomic($1, $2, $3::jsonb)`, [
          ANY_UUID,
          ANY_UUID,
          JSON.stringify({}),
        ]),
      ).rejects.toThrow(/permission denied/i);
    });
  });

  it("allows service_role to execute (reaches the function's own validation)", async () => {
    await withRollback(async (tx) => {
      await tx.query(`set local role service_role`);
      // An empty payload makes the function raise its OWN validation error, which
      // proves the execute grant — a permission failure would surface instead.
      await expect(
        tx.query(`select public.record_payment_atomic($1, $2::jsonb)`, [
          ANY_UUID,
          JSON.stringify({}),
        ]),
      ).rejects.toThrow(/amount must be positive/i);
    });
  });
});
