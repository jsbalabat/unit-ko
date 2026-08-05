import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { TransferTenantResult } from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import { TenantsService } from "./tenants.service";
import { TenantsRepository } from "./tenants.repository";

// Typed partial test double: only the methods a test exercises are provided.
const stub = <T extends object>(impl: Partial<T>): T => impl as T;

const transferResult: TransferTenantResult = {
  tenantId: "t1",
  fromPropertyId: "propA",
  toPropertyId: "propB",
  fromLeaseId: "leaseA",
  toLeaseId: "leaseB",
  transferredCount: 2,
};

describe("TenantsService.transfer", () => {
  it("logs tenant_transferred (attributed to the destination) and returns the result", async () => {
    const log = vi.fn<ActivityService["log"]>().mockResolvedValue(undefined);
    const repo = stub<TenantsRepository>({
      transferViaAtomicRpc: vi
        .fn<TenantsRepository["transferViaAtomicRpc"]>()
        .mockResolvedValue(transferResult),
    });
    const service = new TenantsService(repo, stub<ActivityService>({ log }));

    const result = await service.transfer("landlord1", "t1", {
      toPropertyId: "propB",
    });

    expect(result).toEqual(transferResult);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "tenant_transferred",
        userId: "landlord1",
        propertyId: "propB",
        tenantId: "t1",
        leaseId: "leaseB",
        metadata: expect.objectContaining({
          fromPropertyId: "propA",
          toPropertyId: "propB",
          transferredCount: 2,
        }),
      }),
    );
  });

  it("maps 'no active lease' to a Conflict and never logs", async () => {
    const log = vi.fn<ActivityService["log"]>().mockResolvedValue(undefined);
    const repo = stub<TenantsRepository>({
      transferViaAtomicRpc: vi
        .fn<TenantsRepository["transferViaAtomicRpc"]>()
        .mockRejectedValue(new Error("tenant has no active lease to transfer")),
    });
    const service = new TenantsService(repo, stub<ActivityService>({ log }));

    await expect(
      service.transfer("landlord1", "t1", { toPropertyId: "propB" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(log).not.toHaveBeenCalled();
  });

  it("maps a destination the landlord does not own to NotFound", async () => {
    const repo = stub<TenantsRepository>({
      transferViaAtomicRpc: vi
        .fn<TenantsRepository["transferViaAtomicRpc"]>()
        .mockRejectedValue(
          new Error("destination property not owned by landlord"),
        ),
    });
    const service = new TenantsService(repo, stub<ActivityService>({}));

    await expect(
      service.transfer("landlord1", "t1", { toPropertyId: "propB" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

const tenantRow = (over: Record<string, unknown> = {}) => ({
  id: "t1",
  tenant_name: "Ana Cruz",
  email: null,
  contact_number: "09170000000",
  property_id: "propB" as string | null,
  tenant_slot: 1,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  properties: { unit_name: "Unit B" },
  ...over,
});

describe("TenantsService.assign", () => {
  it("places an unhoused tenant on a property and logs the assignment", async () => {
    const log = vi.fn<ActivityService["log"]>().mockResolvedValue(undefined);
    const repo = stub<TenantsRepository>({
      findByIdForLandlord: vi
        .fn<TenantsRepository["findByIdForLandlord"]>()
        .mockResolvedValue(tenantRow({ property_id: null })),
      assignToProperty: vi
        .fn<TenantsRepository["assignToProperty"]>()
        .mockResolvedValue(tenantRow()),
    });
    const service = new TenantsService(repo, stub<ActivityService>({ log }));

    const result = await service.assign("landlord1", "t1", {
      propertyId: "propB",
    });

    expect(result.propertyId).toBe("propB");
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "tenant_updated",
        propertyId: "propB",
        metadata: { assignedToPropertyId: "propB" },
      }),
    );
  });

  it("rejects assigning a tenant that is already housed", async () => {
    const repo = stub<TenantsRepository>({
      findByIdForLandlord: vi
        .fn<TenantsRepository["findByIdForLandlord"]>()
        .mockResolvedValue(tenantRow()),
    });
    const service = new TenantsService(repo, stub<ActivityService>({}));

    await expect(
      service.assign("landlord1", "t1", { propertyId: "propB" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps a destination the landlord does not own to NotFound", async () => {
    const repo = stub<TenantsRepository>({
      findByIdForLandlord: vi
        .fn<TenantsRepository["findByIdForLandlord"]>()
        .mockResolvedValue(tenantRow({ property_id: null })),
      assignToProperty: vi
        .fn<TenantsRepository["assignToProperty"]>()
        .mockRejectedValue(new Error("property not found")),
    });
    const service = new TenantsService(repo, stub<ActivityService>({}));

    await expect(
      service.assign("landlord1", "t1", { propertyId: "propB" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
