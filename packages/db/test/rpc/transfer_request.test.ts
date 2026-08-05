import { describe, expect, it } from "vitest";
import type { Tx } from "../helpers/client";
import { withRollback } from "../helpers/client";
import {
  seedLandlord,
  seedLeaseWithEntry,
  seedProperty,
  seedTenant,
} from "../helpers/fixtures";
import { callRpc } from "../helpers/rpc";

// The transfer handshake (schemas/50_functions.sql): a landlord proposes a transfer
// (create_transfer_request_atomic — no data moves), and the tenant resolves it
// (resolve_transfer_request_atomic). Confirm runs the actual move + stamps
// 'confirmed'; reject stamps 'rejected' and leaves everything put.

interface RequestResult {
  requestId: string;
  status: string;
}

async function requestStatus(tx: Tx, id: string): Promise<string> {
  const { rows } = await tx.query<{ status: string }>(
    `select status from public.tenant_transfer_requests where id = $1`,
    [id],
  );
  return rows[0].status;
}

async function tenantPropertyId(tx: Tx, id: string): Promise<string | null> {
  const { rows } = await tx.query<{ property_id: string | null }>(
    `select property_id from public.tenants where id = $1`,
    [id],
  );
  return rows[0].property_id;
}

describe("transfer request handshake", () => {
  it("proposes a pending request without moving the tenant", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { propertyId: fromProp, tenantId } = await seedLeaseWithEntry(
        tx,
        landlordId,
        { entry: { rentDue: 1000 } },
      );
      const toProp = await seedProperty(tx, landlordId, { unitName: "B" });

      const res = await callRpc<RequestResult>(
        tx,
        "create_transfer_request_atomic",
        landlordId,
        { tenantId, toPropertyId: toProp },
      );

      expect(res.status).toBe("pending");
      expect(await requestStatus(tx, res.requestId)).toBe("pending");
      expect(await tenantPropertyId(tx, tenantId)).toBe(fromProp); // nothing moved
    });
  });

  it("refuses a second pending request for the same tenant", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { tenantId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });
      const toProp = await seedProperty(tx, landlordId, {});
      await callRpc(tx, "create_transfer_request_atomic", landlordId, {
        tenantId,
        toPropertyId: toProp,
      });

      await expect(
        callRpc(tx, "create_transfer_request_atomic", landlordId, {
          tenantId,
          toPropertyId: toProp,
        }),
      ).rejects.toThrow(/already pending/i);
    });
  });

  it("refuses to propose a transfer to a property at capacity", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { tenantId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });
      // A one-slot destination, already occupied by another active tenant.
      const fullProp = await seedProperty(tx, landlordId, {
        unitName: "Full",
        maxTenants: 1,
      });
      await seedTenant(tx, landlordId, fullProp, {});

      await expect(
        callRpc(tx, "create_transfer_request_atomic", landlordId, {
          tenantId,
          toPropertyId: fullProp,
        }),
      ).rejects.toThrow(/full/i);
    });
  });

  it("confirms a request — moves the tenant and marks it confirmed", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { tenantId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000, dueDate: "2026-06-01", sequence: 1 },
      });
      const toProp = await seedProperty(tx, landlordId, { unitName: "B" });
      const req = await callRpc<RequestResult>(
        tx,
        "create_transfer_request_atomic",
        landlordId,
        { tenantId, toPropertyId: toProp },
      );

      const res = await callRpc<{ status: string }>(
        tx,
        "resolve_transfer_request_atomic",
        tenantId,
        req.requestId,
        true,
      );

      expect(res.status).toBe("confirmed");
      expect(await requestStatus(tx, req.requestId)).toBe("confirmed");
      expect(await tenantPropertyId(tx, tenantId)).toBe(toProp);
    });
  });

  it("rejects a request — leaves the tenant put and marks it rejected", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { propertyId: fromProp, tenantId } = await seedLeaseWithEntry(
        tx,
        landlordId,
        { entry: { rentDue: 1000 } },
      );
      const toProp = await seedProperty(tx, landlordId, {});
      const req = await callRpc<RequestResult>(
        tx,
        "create_transfer_request_atomic",
        landlordId,
        { tenantId, toPropertyId: toProp },
      );

      const res = await callRpc<{ status: string }>(
        tx,
        "resolve_transfer_request_atomic",
        tenantId,
        req.requestId,
        false,
      );

      expect(res.status).toBe("rejected");
      expect(await requestStatus(tx, req.requestId)).toBe("rejected");
      expect(await tenantPropertyId(tx, tenantId)).toBe(fromProp);
    });
  });

  it("refuses to resolve another tenant's request", async () => {
    await withRollback(async (tx) => {
      const landlordId = await seedLandlord(tx);
      const { tenantId } = await seedLeaseWithEntry(tx, landlordId, {
        entry: { rentDue: 1000 },
      });
      const toProp = await seedProperty(tx, landlordId, {});
      const req = await callRpc<RequestResult>(
        tx,
        "create_transfer_request_atomic",
        landlordId,
        { tenantId, toPropertyId: toProp },
      );
      const otherTenant = await seedTenant(tx, landlordId, null, {});

      await expect(
        callRpc(
          tx,
          "resolve_transfer_request_atomic",
          otherTenant,
          req.requestId,
          true,
        ),
      ).rejects.toThrow(/not found/i);
    });
  });
});
