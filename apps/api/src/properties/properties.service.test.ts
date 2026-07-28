import { describe, expect, it, vi } from "vitest";
import { ActivityService } from "../activity/activity.service";
import { PropertiesRepository } from "./properties.repository";
import { PropertiesService, toLeaseTerms } from "./properties.service";

const stub = <T extends object>(impl: Partial<T>): T => impl as T;

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
        metadata: { noteId: "note1" },
      }),
    );
  });
});
