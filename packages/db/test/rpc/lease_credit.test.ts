import { describe, expect, it } from "vitest";
import type { Tx } from "../helpers/client";
import { withRollback } from "../helpers/client";
import {
  addCharge,
  seedEntry,
  seedLandlord,
  seedLeaseWithEntry,
} from "../helpers/fixtures";
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

async function leaseCredit(
  tx: Tx,
  leaseId: string,
): Promise<{ pool: number; applied: number; available: number }> {
  const { rows } = await tx.query<{
    credit_pool: string;
    credit_applied: string;
    credit_available: string;
  }>(
    `select credit_pool, credit_applied, credit_available
     from public.v_lease_credit where lease_id = $1`,
    [leaseId],
  );
  return {
    pool: Number(rows[0].credit_pool),
    applied: Number(rows[0].credit_applied),
    available: Number(rows[0].credit_available),
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

  // Mirrors the reported scenario: overpay past the total, then a new payable is
  // added to a now-settled invoice — the surplus credit must cover it.
  it("covers a charge added after an overpayment settled everything", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 30000, dueDate: "2026-06-01", sequence: 1 },
      });
      // Pay 50000 on a 30000 invoice: 30000 settles it, 20000 becomes lease credit.
      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: entryId,
        amount: 50000,
      });
      // A new payable added after the fact.
      await addCharge(tx, entryId, 5000, "Late fee");

      const e = await entryRow(tx, entryId);
      expect(e.applied_credit).toBe(5000);
      expect(e.balance).toBe(0);
      expect(e.status_code).toBe("Paid");
    });
  });

  it("tracks the lease credit pool, applied, and available (v_lease_credit)", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { leaseId, entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 30000, dueDate: "2026-06-01", sequence: 1 },
      });
      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: entryId,
        amount: 50000,
      });

      // 20000 surplus, nothing drawn down yet.
      expect(await leaseCredit(tx, leaseId)).toEqual({
        pool: 20000,
        applied: 0,
        available: 20000,
      });

      // A 5000 charge draws 5000 from the pool.
      await addCharge(tx, entryId, 5000, "Late fee");
      expect(await leaseCredit(tx, leaseId)).toEqual({
        pool: 20000,
        applied: 5000,
        available: 15000,
      });
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

  it("draws credit down oldest-first across multiple open invoices, exhausting the pool", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { leaseId, entryId: aId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000, dueDate: "2026-06-01", sequence: 1 },
      });
      // Overpay A by 500 -> a 500 lease credit.
      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: aId,
        amount: 1500,
      });
      // Two newer invoices: the 500 pool covers B in full, then C only partially.
      const bId = await seedEntry(tx, leaseId, {
        rentDue: 300,
        dueDate: "2026-07-01",
        sequence: 2,
      });
      const cId = await seedEntry(tx, leaseId, {
        rentDue: 400,
        dueDate: "2026-08-01",
        sequence: 3,
      });

      const b = await entryRow(tx, bId);
      expect(b.applied_credit).toBe(300);
      expect(b.balance).toBe(0);
      expect(b.status_code).toBe("Paid");

      // C claims only what B left behind: 500 - 300 = 200.
      const c = await entryRow(tx, cId);
      expect(c.applied_credit).toBe(200);
      expect(c.balance).toBe(200);
      expect(c.status_code).toBe("Partial");

      // A is untouched and the pool is fully drawn down.
      expect((await entryRow(tx, aId)).balance).toBe(0);
      expect(await leaseCredit(tx, leaseId)).toEqual({
        pool: 500,
        applied: 500,
        available: 0,
      });
    });
  });
});
