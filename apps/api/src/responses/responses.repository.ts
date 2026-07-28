import { Injectable } from "@nestjs/common";
import type { TenantResponseType } from "@unitko/shared";
import { SupabaseService } from "../supabase/supabase.service";

// A row from the feed view (v_tenant_responses_full). View columns are all
// nullable at the type level (Postgres can't prove a view column non-null); the
// service narrows when mapping to the DTO. landlord_id backs the confirm-side
// ownership check.
export interface TenantResponseView {
  id: string | null;
  billing_entry_id: string | null;
  response_type_code: string | null;
  response_type_label: string | null;
  note: string | null;
  created_at: string | null;
  confirmed_at: string | null;
  due_date: string | null;
  tenant_name: string | null;
  property_name: string | null;
  landlord_id: string | null;
}

// The tenant/property/landlord a billing entry resolves to, for ownership checks
// and activity-log linkage.
export interface EntryContext {
  tenantId: string;
  propertyId: string;
  landlordId: string;
}

const VIEW_COLUMNS =
  "id, billing_entry_id, response_type_code, response_type_label, note, created_at, confirmed_at, due_date, tenant_name, property_name, landlord_id";

@Injectable()
export class ResponsesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  // The tenant / property / landlord a bill belongs to, via its lease; null when
  // the bill (or its lease chain) doesn't exist. Backs two things: the ownership
  // check (caller compares tenantId against the session tenant, so a tenant can't
  // respond to someone else's invoice) and the activity-log ids for the exchange.
  async findEntryContext(
    billingEntryId: string,
  ): Promise<EntryContext | null> {
    const { data: entry, error } = await this.supabase.db
      .from("billing_entries")
      .select("lease_id")
      .eq("id", billingEntryId)
      .maybeSingle();
    if (error) throw error;
    if (!entry?.lease_id) return null;

    const { data: lease, error: lErr } = await this.supabase.db
      .from("leases")
      .select("tenant_id, property_id, properties(landlord_id)")
      .eq("id", entry.lease_id)
      .maybeSingle();
    if (lErr) throw lErr;

    const landlordId = lease?.properties?.landlord_id ?? null;
    if (!lease?.tenant_id || !lease.property_id || !landlordId) return null;
    return {
      tenantId: lease.tenant_id,
      propertyId: lease.property_id,
      landlordId,
    };
  }

  async create(input: {
    billingEntryId: string;
    tenantId: string;
    responseType: TenantResponseType;
    note: string | null;
  }): Promise<string> {
    const { data, error } = await this.supabase.db
      .from("tenant_responses")
      .insert({
        billing_entry_id: input.billingEntryId,
        tenant_id: input.tenantId,
        response_type_code: input.responseType,
        note: input.note,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  async findById(id: string): Promise<TenantResponseView | null> {
    const { data, error } = await this.supabase.db
      .from("v_tenant_responses_full")
      .select(VIEW_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async findByTenant(
    tenantId: string,
    limit: number,
  ): Promise<TenantResponseView[]> {
    const { data, error } = await this.supabase.db
      .from("v_tenant_responses_full")
      .select(VIEW_COLUMNS)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async findByLandlord(
    landlordId: string,
    limit: number,
  ): Promise<TenantResponseView[]> {
    const { data, error } = await this.supabase.db
      .from("v_tenant_responses_full")
      .select(VIEW_COLUMNS)
      .eq("landlord_id", landlordId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  // Stamp the landlord's receipt confirmation. confirmed_by records who, so the
  // action is attributable.
  async confirm(
    id: string,
    landlordId: string,
    confirmedAt: string,
  ): Promise<void> {
    const { error } = await this.supabase.db
      .from("tenant_responses")
      .update({ confirmed_at: confirmedAt, confirmed_by: landlordId })
      .eq("id", id);
    if (error) throw error;
  }
}
