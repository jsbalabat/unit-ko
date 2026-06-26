import { describe, expect, it } from "vitest";
import { withRollback } from "../helpers/client";
import { seedLandlord, seedLeaseWithEntry } from "../helpers/fixtures";
import { callRpc } from "../helpers/rpc";

// claim_tenant_reminder (schemas/50_functions.sql) is the once-per-day claim that
// replaced last_reminded_at: it locks the entry, returns false if already
// reminded today, and otherwise logs the reminder.
describe("claim_tenant_reminder", () => {
  it("grants the first claim of the day and logs it", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });

      const claimed = await callRpc<boolean>(
        tx,
        "claim_tenant_reminder",
        landlordId,
        entryId,
      );
      expect(claimed).toBe(true);

      const { rows } = await tx.query(
        `select 1 from public.reminder_logs where billing_entry_id = $1`,
        [entryId],
      );
      expect(rows).toHaveLength(1);
    });
  });

  it("denies a second claim the same day and does not double-log", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });

      expect(
        await callRpc<boolean>(tx, "claim_tenant_reminder", landlordId, entryId),
      ).toBe(true);
      expect(
        await callRpc<boolean>(tx, "claim_tenant_reminder", landlordId, entryId),
      ).toBe(false);

      const { rows } = await tx.query<{ n: number }>(
        `select count(*)::int as n from public.reminder_logs where billing_entry_id = $1`,
        [entryId],
      );
      expect(rows[0].n).toBe(1);
    });
  });

  it("rejects a claim on another landlord's invoice", async () => {
    await withRollback(async (tx) => {
      const ownerId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, ownerId, {
        entry: { rentDue: 1000 },
      });
      const intruderId = await seedLandlord(tx);

      await expect(
        callRpc(tx, "claim_tenant_reminder", intruderId, entryId),
      ).rejects.toThrow(/not owned by landlord/i);
    });
  });
});
