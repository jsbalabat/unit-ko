import { describe, expect, it } from "vitest";
import { withRollback } from "../helpers/client";
import { seedLandlord, seedLeaseWithEntry } from "../helpers/fixtures";
import { readStatus } from "../helpers/reads";
import { callRpc } from "../helpers/rpc";

// record_payment_atomic (schemas/50_functions.sql) inserts a ledger row, resolves
// ownership, and recomputes status_code from the 5-way ladder. A payment always
// makes paid_amount > 0, so this RPC reaches Paid/Partial/Not-Yet-Set — Overdue is
// only reachable via update_billing_entry_atomic (no payment involved).
interface RecordResult {
  paymentId: string;
  billingEntryId: string | null;
}

describe("record_payment_atomic", () => {
  it("settles an invoice to Paid on full payment and inserts the ledger row", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });

      const res = await callRpc<RecordResult>(
        tx,
        "record_payment_atomic",
        landlordId,
        { billingEntryId: entryId, amount: 1000, paymentType: "rent" },
      );

      expect(res.billingEntryId).toBe(entryId);
      expect(await readStatus(tx, entryId)).toBe("Paid");
      const { rows } = await tx.query(
        `select id from public.payments where id = $1`,
        [res.paymentId],
      );
      expect(rows).toHaveLength(1);
    });
  });

  it("marks a partly-paid invoice Partial", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });

      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: entryId,
        amount: 400,
      });

      expect(await readStatus(tx, entryId)).toBe("Partial");
    });
  });

  it("treats overpayment as Paid", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });

      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: entryId,
        amount: 1500,
      });

      expect(await readStatus(tx, entryId)).toBe("Paid");
    });
  });

  it("keeps a zero-gross invoice at Not Yet Set even after a payment", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 0, statusCode: "Not Yet Set" },
      });

      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: entryId,
        amount: 100,
      });

      expect(await readStatus(tx, entryId)).toBe("Not Yet Set");
    });
  });

  it("records a lease-level payment without touching any invoice status", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId, leaseId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });

      const res = await callRpc<RecordResult>(
        tx,
        "record_payment_atomic",
        landlordId,
        { leaseId, amount: 500, paymentType: "deposit" },
      );

      expect(res.billingEntryId).toBeNull();
      expect(await readStatus(tx, entryId)).toBe("Not Yet Due");
    });
  });

  it("rejects a payment on another landlord's invoice", async () => {
    await withRollback(async (tx) => {
      const ownerId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, ownerId, {
        entry: { rentDue: 1000 },
      });
      const intruderId = await seedLandlord(tx);

      await expect(
        callRpc(tx, "record_payment_atomic", intruderId, {
          billingEntryId: entryId,
          amount: 100,
        }),
      ).rejects.toThrow(/not owned by landlord/i);
    });
  });

  it("rejects a non-positive amount", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });

      await expect(
        callRpc(tx, "record_payment_atomic", landlordId, {
          billingEntryId: entryId,
          amount: 0,
        }),
      ).rejects.toThrow(/amount must be positive/i);
    });
  });

  it("requires either a billing entry or a lease", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);

      await expect(
        callRpc(tx, "record_payment_atomic", landlordId, { amount: 100 }),
      ).rejects.toThrow(/billingEntryId or leaseId is required/i);
    });
  });
});
