import { describe, expect, it } from "vitest";
import type { Tx } from "../helpers/client";
import { withRollback } from "../helpers/client";
import {
  addCharge,
  recordPaymentDirect,
  seedEntry,
  seedLandlord,
  seedLease,
  seedProperty,
  seedTenant,
} from "../helpers/fixtures";

// v_archived_tenants reconstructs the archived-tenant shape from ended leases
// (schemas/70_views.sql). total_due = Σ(rent_due + charges) over the lease's
// entries; total_paid = Σ ALL payments on the lease — including lease-level ones,
// the deliberate asymmetry with v_billing_entries_full.paid_amount.
async function archivedRow(tx: Tx, leaseId: string) {
  const { rows } = await tx.query<{
    id: string;
    total_paid: string;
    total_due: string;
    archive_reason: string | null;
  }>(
    `select id, total_paid, total_due, archive_reason
     from public.v_archived_tenants where id = $1`,
    [leaseId],
  );
  return rows[0];
}

describe("v_archived_tenants", () => {
  it("excludes active leases", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const propertyId = await seedProperty(tx, landlordId);
      const tenantId = await seedTenant(tx, landlordId, propertyId);
      const leaseId = await seedLease(tx, propertyId, tenantId, {
        status: "active",
      });

      expect(await archivedRow(tx, leaseId)).toBeUndefined();
    });
  });

  it("surfaces an ended lease with summed dues and all payments", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const propertyId = await seedProperty(tx, landlordId);
      const tenantId = await seedTenant(tx, landlordId, propertyId, {
        isActive: false,
      });
      const leaseId = await seedLease(tx, propertyId, tenantId, {
        status: "ended",
        endReason: "End of contract",
      });
      const e1 = await seedEntry(tx, leaseId, {
        rentDue: 1000,
        dueDate: "2026-01-01",
      });
      const e2 = await seedEntry(tx, leaseId, {
        rentDue: 1000,
        dueDate: "2026-02-01",
        sequence: 2,
      });
      await addCharge(tx, e2, 200, "Utilities");
      await recordPaymentDirect(tx, { leaseId, tenantId, entryId: e1, amount: 800 });
      // Lease-level deposit: counts toward total_paid here (unlike an entry view).
      await recordPaymentDirect(tx, {
        leaseId,
        tenantId,
        entryId: null,
        amount: 500,
        paymentType: "deposit",
      });

      const row = await archivedRow(tx, leaseId);
      expect(Number(row.total_due)).toBe(2200);
      expect(Number(row.total_paid)).toBe(1300);
      expect(row.archive_reason).toBe("End of contract");
    });
  });
});
