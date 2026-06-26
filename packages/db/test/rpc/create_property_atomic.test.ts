import { describe, expect, it } from "vitest";
import type { Tx } from "../helpers/client";
import { withRollback } from "../helpers/client";
import { seedLandlord } from "../helpers/fixtures";
import { callRpc } from "../helpers/rpc";

// create_property_atomic (schemas/50_functions.sql) builds property + amenities +
// tenants + active leases + the billing schedule in one transaction. This is a
// light pass over the seams that matter: the returned counts, the schedule-driven
// status seeding, the resulting occupancy, and the landlord guard.
interface CreateResult {
  propertyId: string;
  tenantCount: number;
  billingEntryCount: number;
}

const payload = {
  unitName: "Sunrise 2F",
  rentAmount: 1000,
  maxTenants: 2,
  lease: {
    billingFrequency: "monthly",
    rentStartDate: "2026-01-01",
    contractPeriods: 6,
    dueDay: 5,
    rentAmount: 1000,
  },
  tenants: [{ tenantName: "Ana Cruz", contactNumber: "0917" }],
  billingSchedule: [
    { dueDate: "2026-01-05", rentDue: 0 }, // nothing due, no charges -> Not Yet Set
    { dueDate: "2026-02-05", rentDue: 1000 }, // -> Not Yet Due
  ],
};

async function statusesFor(tx: Tx, propertyId: string): Promise<string[]> {
  const { rows } = await tx.query<{ status_code: string }>(
    `select be.status_code
     from public.billing_entries be
     join public.leases l on l.id = be.lease_id
     where l.property_id = $1
     order by be.sequence`,
    [propertyId],
  );
  return rows.map((r) => r.status_code);
}

describe("create_property_atomic", () => {
  it("creates the property, tenant, lease, and billing entries together", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);

      const res = await callRpc<CreateResult>(
        tx,
        "create_property_atomic",
        landlordId,
        payload,
      );

      expect(res.tenantCount).toBe(1);
      expect(res.billingEntryCount).toBe(2);

      const occ = (
        await tx.query<{ occupancy_status: string }>(
          `select occupancy_status from public.v_property_occupancy where property_id = $1`,
          [res.propertyId],
        )
      ).rows[0];
      expect(occ.occupancy_status).toBe("occupied");
    });
  });

  it("seeds invoice status from the schedule (Not Yet Set when nothing is due)", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);

      const res = await callRpc<CreateResult>(
        tx,
        "create_property_atomic",
        landlordId,
        payload,
      );

      expect(await statusesFor(tx, res.propertyId)).toEqual([
        "Not Yet Set",
        "Not Yet Due",
      ]);
    });
  });

  it("requires a landlord id", async () => {
    await withRollback(async (tx) => {
      await expect(
        callRpc(tx, "create_property_atomic", null, payload),
      ).rejects.toThrow(/landlord id is required/i);
    });
  });
});
