import { describe, expect, it, vi } from "vitest";
import type { PropertyDetail } from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import { PropertiesRepository } from "./properties.repository";
import { PropertiesService, toLeaseTerms } from "./properties.service";

const stub = <T extends object>(impl: Partial<T>): T => impl as T;

type PropertyDetailRow = NonNullable<
  Awaited<ReturnType<PropertiesRepository["findDetailByIdForLandlord"]>>
>;

// update() only reads existing.property.unit_name before delegating the reread to
// getDetailForLandlord (spied in the tests below), so a name-only stub suffices.
const existingDetail = stub<PropertyDetailRow>({
  property: stub<PropertyDetailRow["property"]>({ unit_name: "Sunrise 2F" }),
});

describe("toLeaseTerms", () => {
  it("maps a lease row to DTO terms, narrowing the billing frequency", () => {
    expect(
      toLeaseTerms({
        billing_frequency_code: "monthly",
        contract_periods: 6,
        rent_start_date: "2026-06-01",
        rent_end_date: "2026-12-01",
        due_day: 5,
        rent_amount: 1000,
        advance_payment: 1000,
        security_deposit: 2000,
      }),
    ).toEqual({
      billingFrequency: "monthly",
      contractPeriods: 6,
      rentStartDate: "2026-06-01",
      rentEndDate: "2026-12-01",
      dueDay: 5,
      rentAmount: 1000,
      advancePayment: 1000,
      securityDeposit: 2000,
    });
  });

  it("returns null when there is no active lease", () => {
    expect(toLeaseTerms(null)).toBeNull();
  });

  it("falls back to 'monthly' for an unknown frequency and 0 for null amounts", () => {
    expect(
      toLeaseTerms({
        billing_frequency_code: "fortnightly",
        contract_periods: null,
        rent_start_date: null,
        rent_end_date: null,
        due_day: null,
        rent_amount: null,
        advance_payment: null,
        security_deposit: null,
      }),
    ).toEqual({
      billingFrequency: "monthly",
      contractPeriods: null,
      rentStartDate: null,
      rentEndDate: null,
      dueDay: null,
      rentAmount: 0,
      advancePayment: 0,
      securityDeposit: 0,
    });
  });
});

describe("PropertiesService.addNote", () => {
  it("inserts the note, logs it with the new note id, and returns it", async () => {
    const insertNote = vi
      .fn<PropertiesRepository["insertNote"]>()
      .mockResolvedValue({
        id: "note1",
        body: "Leaky faucet in 2F",
        author_id: "landlord1",
        created_at: "2026-07-23T00:00:00.000Z",
        updated_at: "2026-07-23T00:00:00.000Z",
      });
    const log = vi.fn<ActivityService["log"]>().mockResolvedValue(undefined);
    const repo = stub<PropertiesRepository>({
      isOwnedBy: vi
        .fn<PropertiesRepository["isOwnedBy"]>()
        .mockResolvedValue(true),
      insertNote,
    });
    const service = new PropertiesService(repo, stub<ActivityService>({ log }));

    const note = await service.addNote("landlord1", "prop1", {
      body: "Leaky faucet in 2F",
    });

    expect(note.id).toBe("note1");
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "property_note_added",
        propertyId: "prop1",
        metadata: { noteId: "note1", message: "Leaky faucet in 2F" },
      }),
    );
  });

  it("collapses whitespace and truncates a long body in the log excerpt", async () => {
    const longBody = `first line\n\n${"word ".repeat(60)}`;
    const insertNote = vi
      .fn<PropertiesRepository["insertNote"]>()
      .mockResolvedValue({
        id: "note2",
        body: longBody,
        author_id: "landlord1",
        created_at: "2026-07-23T00:00:00.000Z",
        updated_at: "2026-07-23T00:00:00.000Z",
      });
    const log = vi.fn<ActivityService["log"]>().mockResolvedValue(undefined);
    const repo = stub<PropertiesRepository>({
      isOwnedBy: vi
        .fn<PropertiesRepository["isOwnedBy"]>()
        .mockResolvedValue(true),
      insertNote,
    });
    const service = new PropertiesService(repo, stub<ActivityService>({ log }));

    await service.addNote("landlord1", "prop1", { body: longBody });

    // 139 non-newline chars + the ellipsis: proves the body was single-lined and
    // capped at the 140-char bound.
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          message: expect.stringMatching(/^[^\n]{139}…$/),
        }),
      }),
    );
  });
});

describe("PropertiesService.update", () => {
  it("emits a distinct event per reported change instead of one opaque row", async () => {
    const log = vi.fn<ActivityService["log"]>().mockResolvedValue(undefined);
    const repo = stub<PropertiesRepository>({
      findDetailByIdForLandlord: vi
        .fn<PropertiesRepository["findDetailByIdForLandlord"]>()
        .mockResolvedValue(existingDetail),
      updateViaAtomicRpc: vi
        .fn<PropertiesRepository["updateViaAtomicRpc"]>()
        .mockResolvedValue({
          propertyId: "prop1",
          changed: ["details", "lease"],
          removedTenants: [
            {
              tenantId: "t-old",
              tenantName: "Ana Cruz",
              leaseId: "lease-old",
              endReason: "Moved out",
            },
          ],
          addedTenants: [{ tenantId: "t-new", tenantName: "Ben Tan" }],
        }),
    });
    const service = new PropertiesService(repo, stub<ActivityService>({ log }));
    vi.spyOn(service, "getDetailForLandlord").mockResolvedValue(
      stub<PropertyDetail>({ id: "prop1" }),
    );

    await service.update("landlord1", "prop1", {
      property: { unitName: "Sunrise 2F" },
    });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "tenant_removed",
        tenantId: "t-old",
        leaseId: "lease-old",
        metadata: { endReason: "Moved out" },
      }),
    );
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "tenant_added",
        tenantId: "t-new",
      }),
    );
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "property_updated",
        metadata: { changed: ["details", "lease"] },
      }),
    );
  });

  it("logs nothing when the update reports no changes", async () => {
    const log = vi.fn<ActivityService["log"]>().mockResolvedValue(undefined);
    const repo = stub<PropertiesRepository>({
      findDetailByIdForLandlord: vi
        .fn<PropertiesRepository["findDetailByIdForLandlord"]>()
        .mockResolvedValue(existingDetail),
      updateViaAtomicRpc: vi
        .fn<PropertiesRepository["updateViaAtomicRpc"]>()
        .mockResolvedValue({
          propertyId: "prop1",
          changed: [],
          removedTenants: [],
          addedTenants: [],
        }),
    });
    const service = new PropertiesService(repo, stub<ActivityService>({ log }));
    vi.spyOn(service, "getDetailForLandlord").mockResolvedValue(
      stub<PropertyDetail>({ id: "prop1" }),
    );

    await service.update("landlord1", "prop1", {});

    expect(log).not.toHaveBeenCalled();
  });
});
