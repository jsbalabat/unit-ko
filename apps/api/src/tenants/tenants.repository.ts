import { Injectable } from "@nestjs/common";
import type { Database } from "@unitko/db";
import type { CreateTenantInput, UpdateTenantInput } from "@unitko/shared";
import { SupabaseService } from "../supabase/supabase.service";

type TenantUpdate = Database["public"]["Tables"]["tenants"]["Update"];

// Tenant row + its property's unit name (null when unhoused).
const TENANT_SELECT =
  "id, tenant_name, email, contact_number, property_id, tenant_slot, is_active, created_at, properties:property_id(unit_name)";

@Injectable()
export class TenantsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  // Delegates the add to the atomic function; returns the new tenant id. The
  // landlord id is the trusted owner (from the JWT), never the payload.
  async createViaAtomicRpc(
    landlordId: string,
    input: CreateTenantInput,
  ): Promise<string> {
    const { data, error } = await this.supabase.db.rpc(
      "create_unhoused_tenant_atomic",
      { p_landlord_id: landlordId, p_payload: input },
    );
    if (error) throw error;

    if (
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      typeof data.tenantId === "string"
    ) {
      return data.tenantId;
    }
    throw new Error("create_unhoused_tenant_atomic returned an unexpected result");
  }

  async findByIdForLandlord(landlordId: string, tenantId: string) {
    const { data, error } = await this.supabase.db
      .from("tenants")
      .select(TENANT_SELECT)
      .eq("id", tenantId)
      .eq("landlord_id", landlordId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // `assigned` undefined = all; true = housed only; false = unhoused only.
  async findAllByLandlord(landlordId: string, assigned?: boolean) {
    let query = this.supabase.db
      .from("tenants")
      .select(TENANT_SELECT)
      .eq("landlord_id", landlordId);

    if (assigned === true) query = query.not("property_id", "is", null);
    if (assigned === false) query = query.is("property_id", null);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async updateIdentity(
    landlordId: string,
    tenantId: string,
    input: UpdateTenantInput,
  ): Promise<void> {
    const patch: TenantUpdate = {};
    if (input.tenantName !== undefined) patch.tenant_name = input.tenantName;
    if (input.email !== undefined) patch.email = input.email;
    if (input.contactNumber !== undefined) patch.contact_number = input.contactNumber;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    if (Object.keys(patch).length === 0) return;

    const { error } = await this.supabase.db
      .from("tenants")
      .update(patch)
      .eq("id", tenantId)
      .eq("landlord_id", landlordId);
    if (error) throw error;
  }
}
