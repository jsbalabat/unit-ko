import { describe, expect, it } from "vitest";
import { withRollback } from "../helpers/client";
import { seedLandlord, seedProperty, seedTenant } from "../helpers/fixtures";
import { callRpc } from "../helpers/rpc";

describe("assign_tenant_atomic", () => {
  it("assigns an unhoused tenant to a property and allocates the next slot", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const propertyId = await seedProperty(tx, landlordId, { maxTenants: 2 });
      const tenantId = await seedTenant(tx, landlordId, null);

      const result = await callRpc<Record<string, unknown>>(
        tx,
        "assign_tenant_atomic",
        landlordId,
        { tenantId, propertyId },
      );

      expect(result).not.toBeNull();
      expect(result.id).toBe(tenantId);
      expect(result.property_id).toBe(propertyId);
      expect(result.tenant_slot).toBe(1);
      expect(result.is_active).toBe(true);
    });
  });

  it("fails if destination property is full", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const propertyId = await seedProperty(tx, landlordId, { maxTenants: 1 });
      await seedTenant(tx, landlordId, propertyId, { tenantSlot: 1 });
      const unhousedId = await seedTenant(tx, landlordId, null);

      await expect(
        callRpc(tx, "assign_tenant_atomic", landlordId, {
          tenantId: unhousedId,
          propertyId,
        }),
      ).rejects.toThrow(/destination property is full/);
    });
  });

  it("fails if destination property is not owned by landlord", async () => {
    await withRollback(async (tx) => {
      const landlordA = await seedLandlord(tx, "a@example.com");
      const landlordB = await seedLandlord(tx, "b@example.com");
      const propertyB = await seedProperty(tx, landlordB);
      const tenantA = await seedTenant(tx, landlordA, null);

      await expect(
        callRpc(tx, "assign_tenant_atomic", landlordA, {
          tenantId: tenantA,
          propertyId: propertyB,
        }),
      ).rejects.toThrow(/property not found/);
    });
  });
});
