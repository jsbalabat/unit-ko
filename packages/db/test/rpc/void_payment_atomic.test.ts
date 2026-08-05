import { describe, expect, it } from "vitest";
import type { Tx } from "../helpers/client";
import { withRollback } from "../helpers/client";
import { seedEntry, seedLandlord, seedLeaseWithEntry } from "../helpers/fixtures";
import { readStatus } from "../helpers/reads";
import { callRpc } from "../helpers/rpc";

// void_payment_atomic (schemas/50_functions.sql) soft-voids a payment's whole
// batch. Voided rows stay in the ledger for audit but drop out of the derived
// sums, so the invoice balance and status recompute with nothing to unwind by hand.

interface VoidResult {
  voidedCount: number;
  propertyId: string;
  entryIds: string[];
}

async function batchIdForLease(tx: Tx, leaseId: string): Promise<string> {
  const { rows } = await tx.query<{ batch_id: string }>(
    `select distinct batch_id from public.payments where lease_id = $1`,
    [leaseId],
  );
  return rows[0].batch_id;
}

async function balanceOf(tx: Tx, entryId: string): Promise<number> {
  const { rows } = await tx.query<{ balance: string }>(
    `select balance from public.v_billing_entries_full where id = $1`,
    [entryId],
  );
  return Number(rows[0].balance);
}

async function rowOf(
  tx: Tx,
  entryId: string,
): Promise<{ applied_credit: number; balance: number; status_code: string }> {
  const { rows } = await tx.query<{
    applied_credit: string;
    balance: string;
    status_code: string;
  }>(
    `select applied_credit, balance, status_code
     from public.v_billing_entries_full where id = $1`,
    [entryId],
  );
  return {
    applied_credit: Number(rows[0].applied_credit),
    balance: Number(rows[0].balance),
    status_code: rows[0].status_code,
  };
}

async function leaseCreditOf(
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

// The batch of the cash allocation booked against a specific invoice.
async function batchIdForEntry(tx: Tx, entryId: string): Promise<string> {
  const { rows } = await tx.query<{ batch_id: string }>(
    `select batch_id from public.payments where billing_entry_id = $1 limit 1`,
    [entryId],
  );
  return rows[0].batch_id;
}

describe("void_payment_atomic", () => {
  it("restores the invoice balance and status when a payment is voided", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { leaseId, entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });
      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: entryId,
        amount: 1000,
      });
      expect(await readStatus(tx, entryId)).toBe("Paid");
      expect(await balanceOf(tx, entryId)).toBe(0);

      const batchId = await batchIdForLease(tx, leaseId);
      const res = await callRpc<VoidResult>(
        tx,
        "void_payment_atomic",
        landlordId,
        batchId,
      );

      expect(res.voidedCount).toBe(1);
      expect(res.entryIds).toEqual([entryId]);
      expect(await balanceOf(tx, entryId)).toBe(1000);
      // The unpaid, past-due invoice reverts to its derived status.
      expect(await readStatus(tx, entryId)).toBe("Overdue");
    });
  });

  it("voids every allocation of a waterfall batch at once", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { leaseId, entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000, dueDate: "2026-06-01", sequence: 1 },
      });
      const nextId = await seedEntry(tx, leaseId, {
        rentDue: 500,
        dueDate: "2026-07-01",
        sequence: 2,
      });
      // 1200 -> 1000 settles the first invoice, 200 cascades onto the second.
      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: entryId,
        amount: 1200,
        paymentType: "rent",
      });
      expect(await readStatus(tx, entryId)).toBe("Paid");
      expect(await readStatus(tx, nextId)).toBe("Partial");

      const batchId = await batchIdForLease(tx, leaseId);
      const res = await callRpc<VoidResult>(
        tx,
        "void_payment_atomic",
        landlordId,
        batchId,
      );

      expect(res.voidedCount).toBe(2);
      expect(await balanceOf(tx, entryId)).toBe(1000);
      expect(await balanceOf(tx, nextId)).toBe(500);
    });
  });

  it("refuses to void the same batch twice", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { leaseId, entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });
      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: entryId,
        amount: 1000,
      });
      const batchId = await batchIdForLease(tx, leaseId);
      await callRpc(tx, "void_payment_atomic", landlordId, batchId);

      await expect(
        callRpc(tx, "void_payment_atomic", landlordId, batchId),
      ).rejects.toThrow(/already voided/i);
    });
  });

  it("rejects voiding another landlord's payment", async () => {
    await withRollback(async (tx) => {
      const ownerId = await seedLandlord(tx);
      const { leaseId, entryId } = await seedLeaseWithEntry(tx, ownerId, {
        entry: { rentDue: 1000 },
      });
      await callRpc(tx, "record_payment_atomic", ownerId, {
        billingEntryId: entryId,
        amount: 1000,
      });
      const batchId = await batchIdForLease(tx, leaseId);
      const intruderId = await seedLandlord(tx);

      await expect(
        callRpc(tx, "void_payment_atomic", intruderId, batchId),
      ).rejects.toThrow(/not owned by landlord/i);
    });
  });

  it("reopens a credit-covered invoice when the batch that created the credit is voided", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { leaseId, entryId: aId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000, dueDate: "2026-06-01", sequence: 1 },
      });
      // Overpay A: 1000 settles it, 500 becomes a lease credit...
      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: aId,
        amount: 1500,
      });
      // ...which auto-covers a newer invoice added afterwards.
      const bId = await seedEntry(tx, leaseId, {
        rentDue: 800,
        dueDate: "2026-07-01",
        sequence: 2,
      });
      expect(await rowOf(tx, bId)).toMatchObject({
        applied_credit: 500,
        balance: 300,
      });

      // Voiding A's batch removes both its cash and the surplus credit it created.
      const batchId = await batchIdForEntry(tx, aId);
      const res = await callRpc<VoidResult>(
        tx,
        "void_payment_atomic",
        landlordId,
        batchId,
      );
      expect(res.voidedCount).toBe(2); // A's allocation + the surplus credit row

      // A reopens, and B loses the credit that was covering it.
      expect(await rowOf(tx, aId)).toMatchObject({
        applied_credit: 0,
        balance: 1000,
      });
      expect(await rowOf(tx, bId)).toMatchObject({
        applied_credit: 0,
        balance: 800,
      });
      expect(await leaseCreditOf(tx, leaseId)).toMatchObject({
        pool: 0,
        available: 0,
      });
    });
  });

  it("re-flows standing credit to an older invoice when its cash payment is voided", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { leaseId, entryId: aId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000, dueDate: "2026-06-01", sequence: 1 },
      });
      const bId = await seedEntry(tx, leaseId, {
        rentDue: 1000,
        dueDate: "2026-07-01",
        sequence: 2,
      });
      // A paid by its own cash (batch 1).
      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: aId,
        amount: 1000,
      });
      // B overpaid (batch 2): 1000 settles B, 500 surplus sits as available credit —
      // both invoices are now covered, so nothing draws it down yet.
      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: bId,
        amount: 1500,
      });
      expect(await leaseCreditOf(tx, leaseId)).toMatchObject({
        pool: 500,
        applied: 0,
        available: 500,
      });

      // Void only A's cash (batch 1): A reopens and the standing credit flows to it,
      // oldest-open-first — without touching B or the credit's own batch.
      const batchA = await batchIdForEntry(tx, aId);
      const res = await callRpc<VoidResult>(
        tx,
        "void_payment_atomic",
        landlordId,
        batchA,
      );
      expect(res.voidedCount).toBe(1);

      expect(await rowOf(tx, aId)).toMatchObject({
        applied_credit: 500,
        balance: 500,
        status_code: "Partial",
      });
      expect(await rowOf(tx, bId)).toMatchObject({
        applied_credit: 0,
        balance: 0,
        status_code: "Paid",
      });
    });
  });
});
