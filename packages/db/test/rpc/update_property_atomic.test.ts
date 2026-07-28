import { describe, expect, it } from "vitest";
import { withRollback } from "../helpers/client";
import {
  seedLandlord,
  seedLease,
  seedProperty,
  seedTenant,
} from "../helpers/fixtures";
import { callRpc } from "../helpers/rpc";

// update_property_atomic (schemas/50_functions.sql) reports what it changed so the
// API can emit one audit event per real change (tenant in / tenant out / details
// edited) rather than a single opaque 'property_updated'. These cover the report,
// that the mutations still happen, and the ownership guard on removals.
interface UpdateResult {
  propertyId: string;
  changed: string[];
  removedTenants: {
    tenantId: string;
    tenantName: string | null;
    leaseId: string | null;
    endReason: string | null;
  }[];
  addedTenants: { tenantId: string; tenantName: string | null }[];
}

describe("update_property_atomic change report", () => {
  it("reports a removed tenant with its ended lease, and a newly added tenant", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const propertyId = await seedProperty(tx, landlordId, {
        unitName: "Sunrise 2F",
        rentAmount: 1000,
        maxTenants: 3,
      });
      const oldTenant = await seedTenant(tx, landlordId, propertyId, {
        tenantName: "Ana Cruz",
      });
      const oldLease = await seedLease(tx, propertyId, oldTenant, {
        status: "active",
      });

      const res = await callRpc<UpdateResult>(
        tx,
        "update_property_atomic",
        landlordId,
        propertyId,
        {
          property: { unitName: "Sunrise 2F Renamed" },
          removedTenantIds: [oldTenant],
          endReason: "Moved out",
          occupants: [{ tenantName: "Ben Tan", contactNumber: "0918" }],
        },
      );

      expect(res.removedTenants).toHaveLength(1);
      expect(res.removedTenants[0]).toMatchObject({
        tenantId: oldTenant,
        tenantName: "Ana Cruz",
        leaseId: oldLease,
        endReason: "Moved out",
      });
      expect(res.addedTenants).toHaveLength(1);
      expect(res.addedTenants[0].tenantName).toBe("Ben Tan");
      expect(res.changed).toContain("details");

      const removed = (
        await tx.query<{ is_active: boolean }>(
          `select is_active from public.tenants where id = $1`,
          [oldTenant],
        )
      ).rows[0];
      expect(removed.is_active).toBe(false);

      const lease = (
        await tx.query<{ status: string }>(
          `select status from public.leases where id = $1`,
          [oldLease],
        )
      ).rows[0];
      expect(lease.status).toBe("ended");

      const added = (
        await tx.query<{ count: number }>(
          `select count(*)::int as count from public.tenants
           where property_id = $1 and tenant_name = 'Ben Tan' and is_active`,
          [propertyId],
        )
      ).rows[0];
      expect(added.count).toBe(1);
    });
  });

  it("reports only the touched sections and no tenant churn when just details change", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const propertyId = await seedProperty(tx, landlordId, {
        unitName: "Bloom 1A",
      });

      const res = await callRpc<UpdateResult>(
        tx,
        "update_property_atomic",
        landlordId,
        propertyId,
        { property: { unitName: "Bloom 1A Renamed" } },
      );

      expect(res.removedTenants).toEqual([]);
      expect(res.addedTenants).toEqual([]);
      expect(res.changed).toEqual(["details"]);
    });
  });

  it("does not report (or perform) a removal for a tenant the landlord doesn't own", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const otherLandlord = await seedLandlord(tx);
      const propertyId = await seedProperty(tx, landlordId, {});
      const otherProperty = await seedProperty(tx, otherLandlord, {});
      const foreignTenant = await seedTenant(tx, otherLandlord, otherProperty, {
        tenantName: "Not Yours",
      });

      const res = await callRpc<UpdateResult>(
        tx,
        "update_property_atomic",
        landlordId,
        propertyId,
        { removedTenantIds: [foreignTenant] },
      );

      expect(res.removedTenants).toEqual([]);
      const foreign = (
        await tx.query<{ is_active: boolean }>(
          `select is_active from public.tenants where id = $1`,
          [foreignTenant],
        )
      ).rows[0];
      expect(foreign.is_active).toBe(true);
    });
  });

  it("requires a landlord id", async () => {
    await withRollback(async (tx) => {
      await expect(
        callRpc(
          tx,
          "update_property_atomic",
          null,
          "00000000-0000-0000-0000-000000000000",
          {},
        ),
      ).rejects.toThrow(/landlord id is required/i);
    });
  });
});
