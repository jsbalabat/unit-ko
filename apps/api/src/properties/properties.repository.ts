import { Injectable } from "@nestjs/common";
import type { CreatePropertyInput, UpdatePropertyInput } from "@unitko/shared";
import { SupabaseService } from "../supabase/supabase.service";

// Scalar columns selected for a property row, plus the embedded type label and
// a derived occupant count (tenants attached to the property).
const PROPERTY_SUMMARY_SELECT =
  "id, unit_name, property_type_code, property_location, rent_amount, max_tenants, billing_mode, lease_date, created_at, property_types(label), tenants(count)";

@Injectable()
export class PropertiesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  // Delegates the whole property+tenants+leases+billing write to the atomic
  // Postgres function. landlordId comes from the verified JWT and is passed as
  // the trusted owner; it is never taken from the payload. Returns the new id.
  async createViaAtomicRpc(
    landlordId: string,
    input: CreatePropertyInput,
  ): Promise<string> {
    const { data, error } = await this.supabase.db.rpc("create_property_atomic", {
      p_landlord_id: landlordId,
      p_payload: input,
    });
    if (error) throw error;

    if (
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      typeof data.propertyId === "string"
    ) {
      return data.propertyId;
    }
    throw new Error("create_property_atomic returned an unexpected result");
  }

  // Atomic property update. landlordId/propertyId are the trusted scope; the
  // payload carries only the fields to change.
  async updateViaAtomicRpc(
    landlordId: string,
    propertyId: string,
    input: UpdatePropertyInput,
  ): Promise<void> {
    const { error } = await this.supabase.db.rpc("update_property_atomic", {
      p_landlord_id: landlordId,
      p_property_id: propertyId,
      p_payload: input,
    });
    if (error) throw error;
  }

  // All properties owned by one landlord, newest first. Occupancy comes from the
  // v_property_occupancy view (derived from active leases) rather than a stored
  // column, so it's fetched and merged by id.
  async findSummariesByLandlord(landlordId: string) {
    const { data: properties, error } = await this.supabase.db
      .from("properties")
      .select(PROPERTY_SUMMARY_SELECT)
      .eq("landlord_id", landlordId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = properties ?? [];
    const occupancy = await this.fetchOccupancy(rows.map((p) => p.id));
    return rows.map((property) => ({
      property,
      occupancyStatus: occupancy.get(property.id) ?? null,
    }));
  }

  // Property detail scoped to its owner. Returns null if the property doesn't
  // exist OR isn't owned by this landlord — the caller turns that into a 404,
  // so existence is never leaked across owners.
  async findDetailByIdForLandlord(landlordId: string, propertyId: string) {
    const { data: property, error } = await this.supabase.db
      .from("properties")
      .select(PROPERTY_SUMMARY_SELECT)
      .eq("id", propertyId)
      .eq("landlord_id", landlordId)
      .maybeSingle();

    if (error) throw error;
    if (!property) return null;

    const [notes, amenities, tenants, lease, occupancy] = await Promise.all([
      this.fetchNotes(propertyId),
      this.fetchAmenities(propertyId),
      this.fetchTenants(propertyId),
      this.fetchActiveLease(propertyId),
      this.fetchOccupancy([propertyId]),
    ]);

    return {
      property,
      notes,
      amenities,
      tenants,
      lease,
      occupancyStatus: occupancy.get(propertyId) ?? null,
    };
  }

  async isOwnedBy(landlordId: string, propertyId: string): Promise<boolean> {
    const { data, error } = await this.supabase.db
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("landlord_id", landlordId)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  }

  private static readonly NOTE_SELECT =
    "id, body, author_id, created_at, updated_at";

  async insertNote(propertyId: string, authorId: string, body: string) {
    const { data, error } = await this.supabase.db
      .from("property_notes")
      .insert({ property_id: propertyId, author_id: authorId, body })
      .select(PropertiesRepository.NOTE_SELECT)
      .single();
    if (error) throw error;
    return data;
  }

  // Scoped to the property so a note can't be edited via a property that doesn't
  // own it. null = no such note on this property.
  async updateNote(propertyId: string, noteId: string, body: string) {
    const { data, error } = await this.supabase.db
      .from("property_notes")
      .update({ body, updated_at: new Date().toISOString() })
      .eq("id", noteId)
      .eq("property_id", propertyId)
      .select(PropertiesRepository.NOTE_SELECT)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async deleteNote(propertyId: string, noteId: string): Promise<void> {
    const { error } = await this.supabase.db
      .from("property_notes")
      .delete()
      .eq("id", noteId)
      .eq("property_id", propertyId);
    if (error) throw error;
  }

  private async fetchOccupancy(
    propertyIds: string[],
  ): Promise<Map<string, string | null>> {
    if (propertyIds.length === 0) return new Map();

    const { data, error } = await this.supabase.db
      .from("v_property_occupancy")
      .select("property_id, occupancy_status")
      .in("property_id", propertyIds);

    if (error) throw error;

    // View columns are typed nullable (Postgres can't prove a view column is
    // non-null); property_id is really pr.id, so just skip any null defensively.
    const map = new Map<string, string | null>();
    for (const row of data ?? []) {
      if (row.property_id !== null) {
        map.set(row.property_id, row.occupancy_status);
      }
    }
    return map;
  }

  private async fetchNotes(propertyId: string) {
    const { data, error } = await this.supabase.db
      .from("property_notes")
      .select("id, body, author_id, created_at, updated_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  private async fetchAmenities(propertyId: string) {
    const { data, error } = await this.supabase.db
      .from("property_amenities")
      .select("amenity_code, amenities(label)")
      .eq("property_id", propertyId);

    if (error) throw error;
    return data ?? [];
  }

  private async fetchTenants(propertyId: string) {
    const { data, error } = await this.supabase.db
      .from("tenants")
      .select("id, tenant_name, email, contact_number, tenant_slot, is_active")
      .eq("property_id", propertyId)
      .order("tenant_slot", { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data ?? [];
  }

  // The property's current lease terms. Occupants share one set of terms in the
  // create/update flow; limit(1) keeps maybeSingle valid for bed-space properties
  // (which have one active lease per tenant, all carrying the same terms).
  private async fetchActiveLease(propertyId: string) {
    const { data, error } = await this.supabase.db
      .from("leases")
      .select(
        "billing_frequency_code, contract_periods, rent_start_date, rent_end_date, due_day, rent_amount, advance_payment, security_deposit",
      )
      .eq("property_id", propertyId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}
