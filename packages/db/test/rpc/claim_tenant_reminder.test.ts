import { describe, expect, it } from "vitest";
import { withRollback } from "../helpers/client";
import { seedLandlord, seedLeaseWithEntry } from "../helpers/fixtures";
import { callRpc } from "../helpers/rpc";

// claim_tenant_reminder (schemas/50_functions.sql) is the once-per-day claim that
// replaced last_reminded_at: it locks the entry, inserts a 'pending' reminder_logs
// row and returns its id, or returns null when today's slot is already held by an
// active (pending/sent) attempt. A prior 'failed' attempt frees the slot.
describe("claim_tenant_reminder", () => {
  it("grants the first claim of the day and logs a pending row", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });

      const logId = await callRpc<string | null>(
        tx,
        "claim_tenant_reminder",
        landlordId,
        entryId,
      );
      expect(logId).toEqual(expect.any(String));

      const { rows } = await tx.query<{
        status_code: string;
        channel_code: string;
      }>(
        `select status_code, channel_code from public.reminder_logs where id = $1`,
        [logId],
      );
      expect(rows).toEqual([{ status_code: "pending", channel_code: "email" }]);
    });
  });

  it("denies a second claim while an active attempt holds the day's slot", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });

      expect(
        await callRpc<string | null>(
          tx,
          "claim_tenant_reminder",
          landlordId,
          entryId,
        ),
      ).toEqual(expect.any(String));
      expect(
        await callRpc<string | null>(
          tx,
          "claim_tenant_reminder",
          landlordId,
          entryId,
        ),
      ).toBeNull();

      const { rows } = await tx.query<{ n: number }>(
        `select count(*)::int as n from public.reminder_logs where billing_entry_id = $1`,
        [entryId],
      );
      expect(rows[0].n).toBe(1);
    });
  });

  it("frees the day's slot for a retry after a failed attempt", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { entryId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });

      const firstId = await callRpc<string | null>(
        tx,
        "claim_tenant_reminder",
        landlordId,
        entryId,
      );
      await tx.query(
        `update public.reminder_logs set status_code = 'failed' where id = $1`,
        [firstId],
      );

      const retryId = await callRpc<string | null>(
        tx,
        "claim_tenant_reminder",
        landlordId,
        entryId,
      );
      expect(retryId).toEqual(expect.any(String));
      expect(retryId).not.toBe(firstId);

      const { rows } = await tx.query<{ n: number }>(
        `select count(*)::int as n from public.reminder_logs where billing_entry_id = $1`,
        [entryId],
      );
      expect(rows[0].n).toBe(2);
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
