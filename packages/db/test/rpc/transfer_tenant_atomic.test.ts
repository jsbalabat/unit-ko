import { describe, expect, it } from "vitest";
import type { Tx } from "../helpers/client";
import { withRollback } from "../helpers/client";
import {
  seedEntry,
  seedLandlord,
  seedLeaseWithEntry,
  seedProperty,
  seedTenant,
} from "../helpers/fixtures";
import { callRpc } from "../helpers/rpc";

// transfer_tenant_atomic (schemas/50_functions.sql) moves a tenant to another of the
// landlord's properties in one transaction: it ends the source lease (reason
// 'transferred', linked to the new lease), opens a destination lease carrying the
// old terms, moves the tenant, and carries each still-open invoice's remaining
// balance onto the new lease while soft-marking the originals. Fully-paid invoices
// stay put.

interface TransferResult {
  fromPropertyId: string;
  toPropertyId: string;
  fromLeaseId: string;
  toLeaseId: string;
  transferredCount: number;
}

async function leaseRow(tx: Tx, id: string) {
  const { rows } = await tx.query<{
    status: string;
    property_id: string;
    end_reason: string | null;
    transferred_to_lease_id: string | null;
  }>(
    `select status, property_id, end_reason, transferred_to_lease_id
     from public.leases where id = $1`,
    [id],
  );
  return rows[0];
}

async function entryRow(tx: Tx, id: string) {
  const { rows } = await tx.query<{
    balance: string;
    status_code: string;
    transferred_at: string | null;
  }>(
    `select balance, status_code, transferred_at
     from public.v_billing_entries_full where id = $1`,
    [id],
  );
  return {
    balance: Number(rows[0].balance),
    status_code: rows[0].status_code,
    transferred_at: rows[0].transferred_at,
  };
}

async function tenantPropertyId(tx: Tx, id: string): Promise<string | null> {
  const { rows } = await tx.query<{ property_id: string | null }>(
    `select property_id from public.tenants where id = $1`,
    [id],
  );
  return rows[0].property_id;
}

describe("transfer_tenant_atomic", () => {
  it("ends + links the source lease, moves the tenant, and carries open balances", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const {
        propertyId: fromProp,
        tenantId,
        leaseId: fromLease,
        entryId: openEntry,
      } = await seedLeaseWithEntry(tx, landlordId, {
        property: { unitName: "A" },
        lease: { rentAmount: 1000, contractPeriods: 12, dueDay: 5 },
        entry: { rentDue: 1000, dueDate: "2026-06-01", sequence: 1 },
      });

      // A fully-paid invoice (should stay on A) and a partially-paid one (only its
      // 300 remainder should carry).
      const paidEntry = await seedEntry(tx, fromLease, {
        rentDue: 800,
        dueDate: "2026-05-01",
        sequence: 0,
      });
      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: paidEntry,
        amount: 800,
      });
      const partialEntry = await seedEntry(tx, fromLease, {
        rentDue: 500,
        dueDate: "2026-07-01",
        sequence: 2,
      });
      await callRpc(tx, "record_payment_atomic", landlordId, {
        billingEntryId: partialEntry,
        amount: 200,
      });

      const toProp = await seedProperty(tx, landlordId, { unitName: "B" });

      const res = await callRpc<TransferResult>(
        tx,
        "transfer_tenant_atomic",
        landlordId,
        { tenantId, toPropertyId: toProp },
      );

      expect(res.fromPropertyId).toBe(fromProp);
      expect(res.toPropertyId).toBe(toProp);
      expect(res.transferredCount).toBe(2); // open + partial; the paid one stays

      // Source lease ended and linked to the destination.
      const from = await leaseRow(tx, fromLease);
      expect(from.status).toBe("ended");
      expect(from.end_reason).toBe("transferred");
      expect(from.transferred_to_lease_id).toBe(res.toLeaseId);

      // Destination lease active on the destination property.
      const to = await leaseRow(tx, res.toLeaseId);
      expect(to.status).toBe("active");
      expect(to.property_id).toBe(toProp);

      // Tenant moved.
      expect(await tenantPropertyId(tx, tenantId)).toBe(toProp);

      // Open + partial flagged transferred on A (balance 0, status 'Transferred').
      const open = await entryRow(tx, openEntry);
      expect(open.status_code).toBe("Transferred");
      expect(open.balance).toBe(0);
      expect(open.transferred_at).not.toBeNull();

      // Paid invoice untouched on A.
      const paid = await entryRow(tx, paidEntry);
      expect(paid.transferred_at).toBeNull();
      expect(paid.status_code).toBe("Paid");

      // Destination carries the remaining balances: 1000 (open) + 300 (partial).
      const { rows } = await tx.query<{ rent_due: string }>(
        `select rent_due from public.v_billing_entries_full where lease_id = $1`,
        [res.toLeaseId],
      );
      const carried = rows.map((r) => Number(r.rent_due)).sort((a, b) => a - b);
      expect(carried).toEqual([300, 1000]);
    });
  });

  it("rejects transferring to a property the landlord does not own", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { tenantId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });
      const otherId = await seedLandlord(tx);
      const foreignProp = await seedProperty(tx, otherId, {});

      await expect(
        callRpc(tx, "transfer_tenant_atomic", landlordId, {
          tenantId,
          toPropertyId: foreignProp,
        }),
      ).rejects.toThrow(/not owned by landlord/i);
    });
  });

  it("rejects transferring a tenant that has no active lease", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const tenantId = await seedTenant(tx, landlordId, null, {});
      const toProp = await seedProperty(tx, landlordId, {});

      await expect(
        callRpc(tx, "transfer_tenant_atomic", landlordId, {
          tenantId,
          toPropertyId: toProp,
        }),
      ).rejects.toThrow(/no active lease/i);
    });
  });
});
