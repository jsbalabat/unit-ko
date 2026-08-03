import { describe, expect, it } from "vitest";
import type { Tx } from "../helpers/client";
import { withRollback } from "../helpers/client";
import {
  addCharge,
  recordPaymentDirect,
  seedLandlord,
  seedLeaseWithEntry,
} from "../helpers/fixtures";

// v_billing_entries_full (packages/db/supabase/schemas/70_views.sql) derives every
// money figure rather than storing it. These tests pin the formulas:
//   other_charges = Σ charges
//   gross_due     = rent_due + other_charges
//   paid_amount   = Σ payments scoped to this entry (billing_entry_id = id)
//   balance       = gross_due - paid_amount - applied_credit
// Auto-applied lease credit has its own suite (rpc/lease_credit.test.ts); these
// cases keep the pool empty, so applied_credit is 0 throughout.
// numeric columns arrive from node-pg as strings, so coerce before asserting.
async function readEntry(tx: Tx, entryId: string) {
  const { rows } = await tx.query<{
    rent_due: string;
    other_charges: string;
    gross_due: string;
    paid_amount: string;
    balance: string;
  }>(
    `select rent_due, other_charges, gross_due, paid_amount, balance
     from public.v_billing_entries_full where id = $1`,
    [entryId],
  );
  const r = rows[0];
  return {
    rentDue: Number(r.rent_due),
    otherCharges: Number(r.other_charges),
    grossDue: Number(r.gross_due),
    paidAmount: Number(r.paid_amount),
    balance: Number(r.balance),
  };
}

describe("v_billing_entries_full", () => {
  it("derives a bare entry with no charges or payments", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });

      expect(await readEntry(tx, entryId)).toMatchObject({
        rentDue: 1000,
        otherCharges: 0,
        grossDue: 1000,
        paidAmount: 0,
        balance: 1000,
      });
    });
  });

  it("sums multiple charges into other_charges and gross_due", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });
      await addCharge(tx, entryId, 150, "Water");
      await addCharge(tx, entryId, 250, "Electricity");

      const e = await readEntry(tx, entryId);
      expect(e.otherCharges).toBe(400);
      expect(e.grossDue).toBe(1400);
      expect(e.balance).toBe(1400);
    });
  });

  it("sums entry-scoped payments into paid_amount and reduces balance", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId, leaseId, tenantId } = await seedLeaseWithEntry(
        tx,
        landlordId,
        { entry: { rentDue: 1000 } },
      );
      await recordPaymentDirect(tx, { leaseId, tenantId, entryId, amount: 600 });
      await recordPaymentDirect(tx, { leaseId, tenantId, entryId, amount: 150 });

      const e = await readEntry(tx, entryId);
      expect(e.paidAmount).toBe(750);
      expect(e.balance).toBe(250);
    });
  });

  it("lets balance go negative when an entry is overpaid", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId, leaseId, tenantId } = await seedLeaseWithEntry(
        tx,
        landlordId,
        { entry: { rentDue: 1000 } },
      );
      await recordPaymentDirect(tx, { leaseId, tenantId, entryId, amount: 1200 });

      expect((await readEntry(tx, entryId)).balance).toBe(-200);
    });
  });

  it("excludes lease-level payments from an entry's paid_amount", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId, leaseId, tenantId } = await seedLeaseWithEntry(
        tx,
        landlordId,
        { entry: { rentDue: 1000 } },
      );
      // A deposit recorded against the lease, not this invoice, must not pay it down.
      await recordPaymentDirect(tx, {
        leaseId,
        tenantId,
        entryId: null,
        amount: 500,
        paymentType: "deposit",
      });

      const e = await readEntry(tx, entryId);
      expect(e.paidAmount).toBe(0);
      expect(e.balance).toBe(1000);
    });
  });
});
