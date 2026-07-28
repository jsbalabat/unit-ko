import { Injectable, NotFoundException } from "@nestjs/common";
import { BILLING_FREQUENCIES, type BillingFrequency } from "@unitko/shared";
import type {
  BillingMode,
  CreatePropertyInput,
  OccupancyStatus,
  PropertyDetail,
  PropertyLeaseTerms,
  PropertyNote,
  PropertySummary,
  UpdatePropertyInput,
  WritePropertyNoteInput,
} from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import {
  PropertiesRepository,
  type PropertyUpdateResult,
} from "./properties.repository";

interface NoteRow {
  id: string;
  body: string;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

// Shape of a property row as selected by the repository (snake_case from
// Postgres). Kept local: the rest of the app only sees the camelCase DTOs.
interface PropertyRow {
  id: string;
  unit_name: string;
  property_type_code: string | null;
  property_location: string | null;
  rent_amount: number;
  max_tenants: number;
  billing_mode: string;
  lease_date: string | null;
  created_at: string;
  property_types: { label: string } | null;
  tenants: { count: number }[];
}

// Active-lease row as selected by the repository (snake_case from Postgres).
// Numeric/text fields are typed wide so the Supabase row is assignable here.
interface LeaseRow {
  billing_frequency_code: string | null;
  contract_periods: number | null;
  rent_start_date: string | null;
  rent_end_date: string | null;
  due_day: number | null;
  rent_amount: number | null;
  advance_payment: number | null;
  security_deposit: number | null;
}

// billing_mode is a free string at the type level but a CHECK-constrained value
// in the DB; narrow it to the DTO union without an unchecked cast.
function toBillingMode(value: string): BillingMode {
  return value === "per_tenant" ? "per_tenant" : "unified";
}

function toOccupancy(value: string | null): OccupancyStatus {
  return value === "occupied" ? "occupied" : "vacant";
}

// billing_frequency_code is FK-constrained to billing_frequencies (whose codes
// mirror the enum); narrow it to the union without an unchecked cast.
function toBillingFrequency(value: string | null): BillingFrequency {
  for (const f of BILLING_FREQUENCIES) {
    if (f === value) return f;
  }
  return "monthly";
}

// Maps the property's active-lease row to the DTO terms; null when the property
// has no active lease. Exported for unit testing.
export function toLeaseTerms(row: LeaseRow | null): PropertyLeaseTerms | null {
  if (!row) return null;
  return {
    billingFrequency: toBillingFrequency(row.billing_frequency_code),
    contractPeriods: row.contract_periods,
    rentStartDate: row.rent_start_date,
    rentEndDate: row.rent_end_date,
    dueDay: row.due_day,
    rentAmount: row.rent_amount ?? 0,
    advancePayment: row.advance_payment ?? 0,
    securityDeposit: row.security_deposit ?? 0,
  };
}

function toNote(row: NoteRow): PropertyNote {
  return {
    id: row.id,
    body: row.body,
    authorId: row.author_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class PropertiesService {
  constructor(
    private readonly repo: PropertiesRepository,
    private readonly activity: ActivityService,
  ) {}

  async listForLandlord(landlordId: string): Promise<PropertySummary[]> {
    const rows = await this.repo.findSummariesByLandlord(landlordId);
    return rows.map(({ property, occupancyStatus }) =>
      this.toSummary(property, occupancyStatus),
    );
  }

  // Creates the property atomically, then returns its full detail through the
  // normal read path (single source of truth for the response shape).
  async create(
    landlordId: string,
    input: CreatePropertyInput,
  ): Promise<PropertyDetail> {
    const propertyId = await this.repo.createViaAtomicRpc(landlordId, input);
    await this.activity.log({
      actionType: "property_created",
      description: `Property created: ${input.unitName}`,
      userId: landlordId,
      propertyId,
      metadata: {
        tenants: input.tenants.length,
        billingPeriods: input.billingSchedule.length,
      },
    });
    return this.getDetailForLandlord(landlordId, propertyId);
  }

  // Verifies ownership/existence (→ 404) before the atomic update, then returns
  // the refreshed detail through the read path.
  async update(
    landlordId: string,
    propertyId: string,
    input: UpdatePropertyInput,
  ): Promise<PropertyDetail> {
    const existing = await this.repo.findDetailByIdForLandlord(
      landlordId,
      propertyId,
    );
    if (!existing) {
      throw new NotFoundException("Property not found");
    }
    const result = await this.repo.updateViaAtomicRpc(
      landlordId,
      propertyId,
      input,
    );
    await this.logPropertyChanges(
      landlordId,
      propertyId,
      existing.property.unit_name,
      result,
    );
    return this.getDetailForLandlord(landlordId, propertyId);
  }

  // One audit event per real change, so a tenant moving out reads as its own row
  // rather than hiding inside a blanket "property updated".
  private async logPropertyChanges(
    landlordId: string,
    propertyId: string,
    unitName: string,
    result: PropertyUpdateResult,
  ): Promise<void> {
    for (const t of result.removedTenants) {
      await this.activity.log({
        actionType: "tenant_removed",
        description: `Tenant removed: ${t.tenantName ?? "unknown"}`,
        userId: landlordId,
        propertyId,
        tenantId: t.tenantId,
        leaseId: t.leaseId,
        metadata: { endReason: t.endReason },
      });
    }
    for (const t of result.addedTenants) {
      await this.activity.log({
        actionType: "tenant_added",
        description: `Tenant added: ${t.tenantName ?? "unknown"}`,
        userId: landlordId,
        propertyId,
        tenantId: t.tenantId,
      });
    }
    if (result.changed.length > 0) {
      await this.activity.log({
        actionType: "property_updated",
        description: `Property updated: ${unitName}`,
        userId: landlordId,
        propertyId,
        metadata: { changed: result.changed },
      });
    }
  }

  async getDetailForLandlord(
    landlordId: string,
    propertyId: string,
  ): Promise<PropertyDetail> {
    const result = await this.repo.findDetailByIdForLandlord(
      landlordId,
      propertyId,
    );
    if (!result) {
      throw new NotFoundException("Property not found");
    }

    const { property, notes, amenities, tenants, lease, occupancyStatus } =
      result;

    return {
      ...this.toSummary(property, occupancyStatus),
      notes: notes.map((n) => ({
        id: n.id,
        body: n.body,
        authorId: n.author_id,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      })),
      amenities: amenities
        .filter((a) => a.amenities)
        .map((a) => ({ code: a.amenity_code, label: a.amenities?.label ?? a.amenity_code })),
      tenants: tenants.map((t) => ({
        id: t.id,
        tenantName: t.tenant_name,
        email: t.email,
        contactNumber: t.contact_number,
        tenantSlot: t.tenant_slot,
        isActive: t.is_active,
      })),
      lease: toLeaseTerms(lease),
    };
  }

  async addNote(
    landlordId: string,
    propertyId: string,
    input: WritePropertyNoteInput,
  ): Promise<PropertyNote> {
    await this.assertOwned(landlordId, propertyId);
    const row = await this.repo.insertNote(propertyId, landlordId, input.body);
    const note = toNote(row);
    await this.activity.log({
      actionType: "property_note_added",
      description: "Note added",
      userId: landlordId,
      propertyId,
      metadata: { noteId: note.id },
    });
    return note;
  }

  async updateNote(
    landlordId: string,
    propertyId: string,
    noteId: string,
    input: WritePropertyNoteInput,
  ): Promise<PropertyNote> {
    await this.assertOwned(landlordId, propertyId);
    const row = await this.repo.updateNote(propertyId, noteId, input.body);
    if (!row) throw new NotFoundException("Note not found");
    await this.activity.log({
      actionType: "property_note_updated",
      description: "Note updated",
      userId: landlordId,
      propertyId,
      metadata: { noteId },
    });
    return toNote(row);
  }

  async deleteNote(
    landlordId: string,
    propertyId: string,
    noteId: string,
  ): Promise<void> {
    await this.assertOwned(landlordId, propertyId);
    await this.repo.deleteNote(propertyId, noteId);
    await this.activity.log({
      actionType: "property_note_deleted",
      description: "Note deleted",
      userId: landlordId,
      propertyId,
      metadata: { noteId },
    });
  }

  private async assertOwned(
    landlordId: string,
    propertyId: string,
  ): Promise<void> {
    if (!(await this.repo.isOwnedBy(landlordId, propertyId))) {
      throw new NotFoundException("Property not found");
    }
  }

  private toSummary(
    property: PropertyRow,
    occupancyStatus: string | null,
  ): PropertySummary {
    return {
      id: property.id,
      unitName: property.unit_name,
      propertyType: property.property_type_code,
      propertyTypeLabel: property.property_types?.label ?? null,
      propertyLocation: property.property_location,
      rentAmount: property.rent_amount,
      maxTenants: property.max_tenants,
      billingMode: toBillingMode(property.billing_mode),
      leaseDate: property.lease_date,
      occupancyStatus: toOccupancy(occupancyStatus),
      tenantCount: property.tenants[0]?.count ?? 0,
      createdAt: property.created_at,
    };
  }
}
