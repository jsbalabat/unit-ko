import { Injectable } from "@nestjs/common";
import type {
  ArchivePropertyInput,
  ArchiveResult,
  ArchivedTenant,
} from "@unitko/shared";
import { ArchivesRepository } from "./archives.repository";

// v_archived_tenants row (snake_case, all-nullable like any view).
interface ArchivedRow {
  id: string | null;
  property_id: string | null;
  property_name: string | null;
  property_type: string | null;
  property_location: string | null;
  tenant_name: string | null;
  contact_number: string | null;
  contract_months: number | null;
  rent_start_date: string | null;
  rent_end_date: string | null;
  due_day: number | null;
  rent_amount: number | null;
  total_paid: number | null;
  total_due: number | null;
  archive_reason: string | null;
  archived_at: string | null;
  created_at: string | null;
}

@Injectable()
export class ArchivesService {
  constructor(private readonly repo: ArchivesRepository) {}

  async archive(
    landlordId: string,
    input: ArchivePropertyInput,
  ): Promise<ArchiveResult> {
    const { leaseId } = await this.repo.archiveViaAtomicRpc(landlordId, input);
    return { archived: true, leaseId };
  }

  async list(landlordId: string): Promise<ArchivedTenant[]> {
    const rows = await this.repo.findByLandlord(landlordId);
    return rows.flatMap((r) => this.toArchived(r));
  }

  private toArchived(r: ArchivedRow): ArchivedTenant[] {
    if (r.id === null) return [];
    return [
      {
        id: r.id,
        propertyId: r.property_id,
        propertyName: r.property_name,
        propertyType: r.property_type,
        propertyLocation: r.property_location,
        tenantName: r.tenant_name,
        contactNumber: r.contact_number,
        contractMonths: r.contract_months,
        rentStartDate: r.rent_start_date,
        rentEndDate: r.rent_end_date,
        dueDay: r.due_day,
        rentAmount: r.rent_amount,
        totalPaid: r.total_paid ?? 0,
        totalDue: r.total_due ?? 0,
        archiveReason: r.archive_reason,
        archivedAt: r.archived_at,
        createdAt: r.created_at,
      },
    ];
  }
}
