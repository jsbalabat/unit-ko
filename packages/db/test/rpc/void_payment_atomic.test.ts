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
});
