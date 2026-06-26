import { describe, expect, it } from "vitest";
import type { Tx } from "../helpers/client";
import { withRollback } from "../helpers/client";
import {
  addCharge,
  recordPaymentDirect,
  seedLandlord,
  seedLeaseWithEntry,
} from "../helpers/fixtures";
import { readStatus } from "../helpers/reads";
import { callRpc } from "../helpers/rpc";

// update_billing_entry_atomic (schemas/50_functions.sql) edits an invoice and
// recomputes status_code from the same ladder as record_payment_atomic. This is
// the only path that reaches Overdue, since it recomputes with no payment applied.
// due_date is set via SQL relative to current_date so the boundary is exact.
async function setDueDate(tx: Tx, entryId: string, expr: string): Promise<void> {
  await tx.query(
    `update public.billing_entries set due_date = ${expr} where id = $1`,
    [entryId],
  );
}

describe("update_billing_entry_atomic", () => {
  it("recomputes an unpaid past-due invoice to Overdue", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });
      await setDueDate(tx, entryId, "current_date - 1");

      await callRpc(tx, "update_billing_entry_atomic", landlordId, entryId, {});

      expect(await readStatus(tx, entryId)).toBe("Overdue");
    });
  });

  it("treats an invoice due today as Not Yet Due (boundary is strictly past)", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });
      await setDueDate(tx, entryId, "current_date");

      await callRpc(tx, "update_billing_entry_atomic", landlordId, entryId, {});

      expect(await readStatus(tx, entryId)).toBe("Not Yet Due");
    });
  });

  it("keeps Partial ahead of Overdue when a past-due invoice is partly paid", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId, leaseId, tenantId } = await seedLeaseWithEntry(
        tx,
        landlordId,
        { entry: { rentDue: 1000 } },
      );
      await setDueDate(tx, entryId, "current_date - 5");
      await recordPaymentDirect(tx, { leaseId, tenantId, entryId, amount: 300 });

      await callRpc(tx, "update_billing_entry_atomic", landlordId, entryId, {});

      expect(await readStatus(tx, entryId)).toBe("Partial");
    });
  });

  it("drops to Not Yet Set when rent and charges are cleared", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });

      await callRpc(tx, "update_billing_entry_atomic", landlordId, entryId, {
        rentDue: 0,
        charges: [],
      });

      expect(await readStatus(tx, entryId)).toBe("Not Yet Set");
    });
  });

  it("replaces charge lines, skipping blank-named ones", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });
      await addCharge(tx, entryId, 999, "Stale");

      await callRpc(tx, "update_billing_entry_atomic", landlordId, entryId, {
        charges: [
          { name: "Water", amount: 150 },
          { name: "", amount: 9999 },
        ],
      });

      const { rows } = await tx.query<{ name: string }>(
        `select name from public.billing_charges where billing_entry_id = $1 order by name`,
        [entryId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Water");
    });
  });

  it("leaves due_date untouched when the payload omits the dueDate key", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000, dueDate: "2026-03-10" },
      });

      await callRpc(tx, "update_billing_entry_atomic", landlordId, entryId, {
        rentDue: 1200,
      });

      const { rows } = await tx.query<{ due_date: string }>(
        `select to_char(due_date, 'YYYY-MM-DD') as due_date
         from public.billing_entries where id = $1`,
        [entryId],
      );
      expect(rows[0].due_date).toBe("2026-03-10");
    });
  });

  it("rejects an update to another landlord's invoice", async () => {
    await withRollback(async (tx) => {
      const ownerId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, ownerId, {
        entry: { rentDue: 1000 },
      });
      const intruderId = await seedLandlord(tx);

      await expect(
        callRpc(tx, "update_billing_entry_atomic", intruderId, entryId, {
          rentDue: 5,
        }),
      ).rejects.toThrow(/not owned by landlord/i);
    });
  });
});
