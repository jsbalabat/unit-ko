import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class TenantDashboardRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findActiveTenant(tenantId: string) {
    const { data, error } = await this.supabase.db
      .from("tenants")
      .select("id, tenant_name, email, contact_number")
      .eq("id", tenantId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // The tenant's single active lease + its property (uq_active_lease_per_tenant
  // guarantees at most one). null when the tenant has no active lease.
  async findActiveLeaseWithProperty(tenantId: string) {
    const { data, error } = await this.supabase.db
      .from("leases")
      .select(
        "id, contract_periods, rent_start_date, rent_end_date, due_day, rent_amount, billing_frequency_code, properties(id, unit_name, property_type_code, property_location, rent_amount, landlord_id)",
      )
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // The landlord's display name + their payout channels, shown to the tenant so
  // they know where to send rent. Reverse-embeds the methods so a landlord with
  // none still returns their name with an empty list.
  async findLandlordPayout(landlordId: string) {
    const { data, error } = await this.supabase.db
      .from("profiles")
      .select(
        "full_name, landlord_payout_methods(method, account_name, account_number, details)",
      )
      .eq("id", landlordId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}
