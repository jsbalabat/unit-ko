import { describe, expect, it, vi } from "vitest";
import { ArchivesRepository } from "./archives.repository";
import { ArchivesService } from "./archives.service";

const stub = <T extends object>(impl: Partial<T>): T => impl as T;

// `findByLandlord` returns the Supabase-generated view shape; build rows loosely
// (bare `vi.fn()`) so the test isn't coupled to regenerated DB types.
const archivedRow = (over: Record<string, unknown> = {}) => ({
  id: "lease1",
  property_id: "prop1",
  property_name: "Sunrise Flats",
  property_type: "apartment",
  property_location: "Cebu City",
  tenant_name: "Ana Cruz",
  contact_number: "0917",
  contract_months: 12,
  rent_start_date: "2026-01-01",
  rent_end_date: "2026-12-31",
  due_day: 5,
  rent_amount: 1000,
  total_paid: 5000,
  total_due: 12000,
  archive_reason: "moved out",
  archived_at: "2026-06-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("ArchivesService.archive", () => {
  it("returns the archived result carrying the ended lease id", async () => {
    const repo = stub<ArchivesRepository>({
      archiveViaAtomicRpc: vi
        .fn<ArchivesRepository["archiveViaAtomicRpc"]>()
        .mockResolvedValue({ leaseId: "lease1" }),
    });
    const service = new ArchivesService(repo);

    const result = await service.archive("landlord1", {
      propertyId: "prop1",
      tenantId: "tenant1",
      remarks: "Tenant moved out at end of lease",
    });

    expect(result).toEqual({ archived: true, leaseId: "lease1" });
  });
});

describe("ArchivesService.list", () => {
  it("maps rows, drops null-id rows, and defaults null totals to 0", async () => {
    const repo = stub<ArchivesRepository>({
      findByLandlord: vi
        .fn()
        .mockResolvedValue([
          archivedRow({ id: "lease1", total_paid: null, total_due: null }),
          archivedRow({ id: null }),
        ]),
    });
    const service = new ArchivesService(repo);

    const result = await service.list("landlord1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "lease1",
      totalPaid: 0,
      totalDue: 0,
    });
  });
});
