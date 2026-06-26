import { describe, expect, it } from "vitest";
import type { Tx } from "../helpers/client";
import { withRollback } from "../helpers/client";
import { seedLandlord } from "../helpers/fixtures";
import { callRpc } from "../helpers/rpc";

// replace_landlord_payout_methods (schemas/50_functions.sql) takes the complete
// desired set and replaces wholesale: delete-all then reinsert, skipping entries
// with no method.
async function methods(tx: Tx, landlordId: string): Promise<string[]> {
  const { rows } = await tx.query<{ method: string }>(
    `select method from public.landlord_payout_methods
     where landlord_id = $1 order by method`,
    [landlordId],
  );
  return rows.map((r) => r.method);
}

describe("replace_landlord_payout_methods", () => {
  it("inserts the given set of channels", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);

      await callRpc(tx, "replace_landlord_payout_methods", landlordId, [
        { method: "gcash", accountName: "Ana", accountNumber: "0917" },
        { method: "bank", accountName: "Ana", accountNumber: "12345" },
      ]);

      expect(await methods(tx, landlordId)).toEqual(["bank", "gcash"]);
    });
  });

  it("replaces the previous set wholesale", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);

      await callRpc(tx, "replace_landlord_payout_methods", landlordId, [
        { method: "gcash" },
        { method: "bank" },
      ]);
      await callRpc(tx, "replace_landlord_payout_methods", landlordId, [
        { method: "paymaya" },
      ]);

      expect(await methods(tx, landlordId)).toEqual(["paymaya"]);
    });
  });

  it("clears all channels on an empty array", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);

      await callRpc(tx, "replace_landlord_payout_methods", landlordId, [
        { method: "gcash" },
      ]);
      await callRpc(tx, "replace_landlord_payout_methods", landlordId, []);

      expect(await methods(tx, landlordId)).toEqual([]);
    });
  });

  it("skips entries with a blank method", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);

      await callRpc(tx, "replace_landlord_payout_methods", landlordId, [
        { method: "" },
        { method: "gcash" },
      ]);

      expect(await methods(tx, landlordId)).toEqual(["gcash"]);
    });
  });
});
