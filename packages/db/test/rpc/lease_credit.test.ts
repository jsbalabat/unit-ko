import { describe, expect, it } from "vitest";
import type { Tx } from "../helpers/client";
import { withRollback } from "../helpers/client";
import { seedEntry, seedLandlord, seedLeaseWithEntry } from "../helpers/fixtures";
import { callRpc } from "../helpers/rpc";

// Lease credit (an unallocated overpayment surplus) auto-applies in
// v_billing_entries_full — drawn down oldest-invoice-first against open balances,
// with deposits/advances excluded from the pool. This exercises the view, not an
// RPC: record_payment_atomic only books the surplus; the application is derived.

async function entryRow(
  tx: Tx,
  id: string,
): Promise<{ applied_credit: number; balance: number; status_code: string }> {
  const { rows } = await tx.query<{
    applied_credit: string;
    balance: string;
    status_code: string;
  }>(
    `select applied_credit, balance, status_code
     from public.v_billing_entries_full where id = $1`,
    [id],
  );
  return {
    applied_credit: Number(rows[0].applied_credit),
    balance: Number(rows[0].balance),
    status_code: rows[0].status_code,
  };
}

describe("lease credit auto-application (v_billing_entries_full)", () => {
  it("applies an overpayment surplus to a newer unpaid invoice without double-dipping", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { leaseId, entryId: aId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000, dueDate: "2026-06-01", sequence: 1 },
      });
      // Overpay A: 1000 settles it, 500 becomes an unallocated lease credit.
      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: aId,
        amount: 1500,
      });
      const bId = await seedEntry(tx, leaseId, {
        rentDue: 800,
        dueDate: "2026-07-01",
        sequence: 2,
      });

      const b = await entryRow(tx, bId);
      expect(b.applied_credit).toBe(500);
      expect(b.balance).toBe(300);
      expect(b.status_code).toBe("Partial");

      // A stays fully paid — the credit didn't re-apply to the invoice it came from.
      const a = await entryRow(tx, aId);
      expect(a.applied_credit).toBe(0);
      expect(a.balance).toBe(0);
      expect(a.status_code).toBe("Paid");
    });
  });

  it("fully covers a smaller newer invoice from credit alone", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { leaseId, entryId: aId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000, dueDate: "2026-06-01", sequence: 1 },
      });
      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: aId,
        amount: 1400,
      });
      const bId = await seedEntry(tx, leaseId, {
        rentDue: 400,
        dueDate: "2026-07-01",
        sequence: 2,
      });

      const b = await entryRow(tx, bId);
      expect(b.applied_credit).toBe(400);
      expect(b.balance).toBe(0);
      expect(b.status_code).toBe("Paid");
    });
  });

  it("excludes deposits and advances from the credit pool", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { leaseId, entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000, dueDate: "2026-06-01", sequence: 1 },
      });
      // A lease-level deposit must not reduce any invoice balance.
      await callRpc(tx, "record_payment_atomic", landlordId, {
        leaseId,
        amount: 500,
        paymentType: "deposit",
      });

      const a = await entryRow(tx, entryId);
      expect(a.applied_credit).toBe(0);
      expect(a.balance).toBe(1000);
      expect(a.status_code).toBe("Overdue");
    });
  });
});
