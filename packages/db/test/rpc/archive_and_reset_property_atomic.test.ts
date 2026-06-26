import { describe, expect, it } from "vitest";
import { withRollback } from "../helpers/client";
import {
  seedLandlord,
  seedLease,
  seedProperty,
  seedTenant,
} from "../helpers/fixtures";
import { callRpc } from "../helpers/rpc";

// archive_and_reset_property_atomic (schemas/50_functions.sql) ends the active
// lease and frees the tenant's slot, with no deletes — history stays relational
// and the lease then surfaces in v_archived_tenants.
interface ArchiveResult {
  archived: boolean;
  leaseId: string | null;
}

describe("archive_and_reset_property_atomic", () => {
  it("ends the lease, frees the tenant, and surfaces it in v_archived_tenants", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const propertyId = await seedProperty(tx, landlordId);
      const tenantId = await seedTenant(tx, landlordId, propertyId);
      const leaseId = await seedLease(tx, propertyId, tenantId, {
        status: "active",
      });

      const res = await callRpc<ArchiveResult>(
        tx,
        "archive_and_reset_property_atomic",
        landlordId,
        { propertyId, tenantId, remarks: "Tenant moved out at end of lease" },
      );

      expect(res).toMatchObject({ archived: true, leaseId });

      const lease = (
        await tx.query<{ status: string; end_reason: string | null }>(
          `select status, end_reason from public.leases where id = $1`,
          [leaseId],
        )
      ).rows[0];
      expect(lease.status).toBe("ended");
      expect(lease.end_reason).toBe("Tenant moved out at end of lease");

      const tenant = (
        await tx.query<{ is_active: boolean; property_id: string | null }>(
          `select is_active, property_id from public.tenants where id = $1`,
          [tenantId],
        )
      ).rows[0];
      expect(tenant.is_active).toBe(false);
      expect(tenant.property_id).toBeNull();

      const archived = await tx.query(
        `select 1 from public.v_archived_tenants where id = $1`,
        [leaseId],
      );
      expect(archived.rows).toHaveLength(1);
    });
  });

  it("rejects remarks shorter than 10 characters", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const propertyId = await seedProperty(tx, landlordId);
      const tenantId = await seedTenant(tx, landlordId, propertyId);
      await seedLease(tx, propertyId, tenantId, { status: "active" });

      await expect(
        callRpc(tx, "archive_and_reset_property_atomic", landlordId, {
          propertyId,
          tenantId,
          remarks: "short",
        }),
      ).rejects.toThrow(/at least 10 characters/i);
    });
  });

  it("rejects a tenant that is not on the given property", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const propertyId = await seedProperty(tx, landlordId);
      const otherPropertyId = await seedProperty(tx, landlordId, {
        unitName: "Other Unit",
      });
      const tenantId = await seedTenant(tx, landlordId, otherPropertyId);

      await expect(
        callRpc(tx, "archive_and_reset_property_atomic", landlordId, {
          propertyId,
          tenantId,
          remarks: "Valid remarks here",
        }),
      ).rejects.toThrow(/tenant not found on this property/i);
    });
  });
});
