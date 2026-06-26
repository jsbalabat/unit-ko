import { describe, expect, it } from "vitest";
import type { Tx } from "../helpers/client";
import { withRollback } from "../helpers/client";
import {
  seedLandlord,
  seedLease,
  seedProperty,
  seedTenant,
} from "../helpers/fixtures";

// v_property_occupancy derives occupancy from the existence of an active lease
// (schemas/70_views.sql) rather than a hand-maintained column.
async function occupancy(tx: Tx, propertyId: string): Promise<string> {
  const { rows } = await tx.query<{ occupancy_status: string }>(
    `select occupancy_status from public.v_property_occupancy where property_id = $1`,
    [propertyId],
  );
  return rows[0].occupancy_status;
}

describe("v_property_occupancy", () => {
  it("reports a property with an active lease as occupied", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const propertyId = await seedProperty(tx, landlordId);
      const tenantId = await seedTenant(tx, landlordId, propertyId);
      await seedLease(tx, propertyId, tenantId, { status: "active" });

      expect(await occupancy(tx, propertyId)).toBe("occupied");
    });
  });

  it("reports a property whose only lease has ended as vacant", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const propertyId = await seedProperty(tx, landlordId);
      const tenantId = await seedTenant(tx, landlordId, propertyId, {
        isActive: false,
      });
      await seedLease(tx, propertyId, tenantId, {
        status: "ended",
        endReason: "moved out",
      });

      expect(await occupancy(tx, propertyId)).toBe("vacant");
    });
  });

  it("reports a property with no leases as vacant", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const propertyId = await seedProperty(tx, landlordId);

      expect(await occupancy(tx, propertyId)).toBe("vacant");
    });
  });
});
