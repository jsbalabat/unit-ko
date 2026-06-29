import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { UpdateBillingEntryInput } from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import { BillingService } from "./billing.service";
import {
  BillingRepository,
  type BillingEntryView,
  type EnrichedEntry,
} from "./billing.repository";

// Typed partial test double: only the methods a test exercises are provided.
// `Partial<T> as T` is accepted (T is comparable to its own Partial), so no
// `as unknown as` / `any` is needed to satisfy the constructor's class type.
const stub = <T extends object>(impl: Partial<T>): T => impl as T;

const view = (over: Partial<BillingEntryView> = {}): BillingEntryView => ({
  id: "entry1",
  lease_id: "lease1",
  period_id: null,
  due_date: "2026-06-01",
  rent_due: 1000,
  status_code: "Paid",
  sequence: 1,
  other_charges: 0,
  gross_due: 1000,
  paid_amount: 1000,
  balance: 0,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
  ...over,
});

const enriched = (over: Partial<EnrichedEntry> = {}): EnrichedEntry => ({
  entry: view(),
  tenantId: "tenant1",
  tenantName: "Ana Cruz",
  charges: [],
  ...over,
});

describe("BillingService.listForProperty", () => {
  it("rejects with NotFound when the property is not the landlord's", async () => {
    const repo = stub<BillingRepository>({
      assertPropertyOwned: vi
        .fn<BillingRepository["assertPropertyOwned"]>()
        .mockResolvedValue(false),
    });
    const service = new BillingService(repo, stub<ActivityService>({}));

    await expect(
      service.listForProperty("landlord1", "prop1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("drops view rows whose id is null instead of asserting non-null", async () => {
    const repo = stub<BillingRepository>({
      assertPropertyOwned: vi
        .fn<BillingRepository["assertPropertyOwned"]>()
        .mockResolvedValue(true),
      findEntriesByProperty: vi
        .fn<BillingRepository["findEntriesByProperty"]>()
        .mockResolvedValue([
          enriched({ entry: view({ id: "keep" }) }),
          enriched({ entry: view({ id: null }) }),
        ]),
    });
    const service = new BillingService(repo, stub<ActivityService>({}));

    const result = await service.listForProperty("landlord1", "prop1");

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("keep");
  });

  it("defaults null derived figures to 0 and unknown status codes to 'Not Yet Set'", async () => {
    const repo = stub<BillingRepository>({
      assertPropertyOwned: vi
        .fn<BillingRepository["assertPropertyOwned"]>()
        .mockResolvedValue(true),
      findEntriesByProperty: vi
        .fn<BillingRepository["findEntriesByProperty"]>()
        .mockResolvedValue([
          enriched({
            entry: view({
              rent_due: null,
              other_charges: null,
              gross_due: null,
              paid_amount: null,
              balance: null,
              status_code: "not-a-real-status",
            }),
          }),
        ]),
    });
    const service = new BillingService(repo, stub<ActivityService>({}));

    const [entry] = await service.listForProperty("landlord1", "prop1");

    expect(entry).toMatchObject({
      rentDue: 0,
      otherCharges: 0,
      grossDue: 0,
      paidAmount: 0,
      balance: 0,
      status: "Not Yet Set",
    });
  });
});

describe("BillingService.updateEntry", () => {
  const input: UpdateBillingEntryInput = { rentDue: 1500 };

  it("recomputes via the RPC, re-reads the derived row, and logs the edit", async () => {
    const updateRpc = vi
      .fn<BillingRepository["updateEntryViaAtomicRpc"]>()
      .mockResolvedValue(undefined);
    const log = vi.fn<ActivityService["log"]>().mockResolvedValue(undefined);
    const repo = stub<BillingRepository>({
      updateEntryViaAtomicRpc: updateRpc,
      findEntryDetailById: vi
        .fn<BillingRepository["findEntryDetailById"]>()
        .mockResolvedValue(enriched({ entry: view({ id: "entry1", lease_id: "lease9" }) })),
    });
    const service = new BillingService(repo, stub<ActivityService>({ log }));

    const result = await service.updateEntry("landlord1", "entry1", input);

    expect(updateRpc).toHaveBeenCalledWith("landlord1", "entry1", input);
    expect(result.id).toBe("entry1");
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "billing_updated",
        userId: "landlord1",
        leaseId: "lease9",
        metadata: { billingEntryId: "entry1" },
      }),
    );
  });

  it("rejects with NotFound (and never logs) when the entry is gone after the update", async () => {
    const log = vi.fn<ActivityService["log"]>().mockResolvedValue(undefined);
    const repo = stub<BillingRepository>({
      updateEntryViaAtomicRpc: vi
        .fn<BillingRepository["updateEntryViaAtomicRpc"]>()
        .mockResolvedValue(undefined),
      findEntryDetailById: vi
        .fn<BillingRepository["findEntryDetailById"]>()
        .mockResolvedValue(null),
    });
    const service = new BillingService(repo, stub<ActivityService>({ log }));

    await expect(
      service.updateEntry("landlord1", "missing", input),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(log).not.toHaveBeenCalled();
  });
});
