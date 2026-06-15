import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  BillingMode,
  CreatePropertyInput,
  OccupancyStatus,
  PropertyDetail,
  PropertySummary,
  UpdatePropertyInput,
} from "@unitko/shared";
import { PropertiesRepository } from "./properties.repository";

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

// billing_mode is a free string at the type level but a CHECK-constrained value
// in the DB; narrow it to the DTO union without an unchecked cast.
function toBillingMode(value: string): BillingMode {
  return value === "per_tenant" ? "per_tenant" : "unified";
}

function toOccupancy(value: string | null): OccupancyStatus {
  return value === "occupied" ? "occupied" : "vacant";
}

@Injectable()
export class PropertiesService {
  constructor(private readonly repo: PropertiesRepository) {}

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
    await this.repo.updateViaAtomicRpc(landlordId, propertyId, input);
    return this.getDetailForLandlord(landlordId, propertyId);
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

    const { property, notes, amenities, tenants, occupancyStatus } = result;

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
    };
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
