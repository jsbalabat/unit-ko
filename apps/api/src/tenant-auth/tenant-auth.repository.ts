import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

// Raw data access only. No business rules, no HTTP concerns — just typed reads
// against the normalized `tenants` table via the service-role client.
@Injectable()
export class TenantAuthRepository {
  constructor(private readonly supabase: SupabaseService) {}

  // Resolve a tenant by their login credentials (email + contact number). In
  // the normalized schema, tenant identity lives entirely on `tenants`, so this
  // is a single lookup — the legacy `profiles.tenant_id` indirection is gone.
  async findActiveTenantIdByCredentials(
    email: string,
    contactNumber: string,
  ): Promise<string | null> {
    const { data, error } = await this.supabase.db
      .from("tenants")
      .select("id")
      .ilike("email", email)
      .eq("contact_number", contactNumber)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    return data?.id ?? null;
  }

  async isTenantActive(tenantId: string): Promise<boolean> {
    const { data, error } = await this.supabase.db
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    return data !== null;
  }
}
