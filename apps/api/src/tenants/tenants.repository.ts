import { Injectable } from "@nestjs/common";
import type { Database } from "@unitko/db";
import {
  TRANSFER_REQUEST_STATUSES,
  type CreateTenantInput,
  type TransferRequest,
  type TransferRequestStatus,
  type UpdateTenantInput,
} from "@unitko/shared";
import { SupabaseService } from "../supabase/supabase.service";

type TenantUpdate = Database["public"]["Tables"]["tenants"]["Update"];

// Tenant row + its property's unit name (null when unhoused).
const TENANT_SELECT =
  "id, tenant_name, email, contact_number, property_id, tenant_slot, is_active, created_at, properties:property_id(unit_name)";

const REQUEST_ROW_COLS =
  "id, tenant_id, from_property_id, to_property_id, status, created_at, resolved_at";

interface TransferRequestRow {
  id: string;
  tenant_id: string;
  from_property_id: string | null;
  to_property_id: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

function toTransferStatus(code: string): TransferRequestStatus {
  for (const s of TRANSFER_REQUEST_STATUSES) {
    if (s === code) return s;
  }
  return "pending";
}

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

  // Place a currently-unhoused tenant onto a property: verify the destination is the
  // landlord's, take the next slot, and flip the tenant onto it — only if it's the
  // landlord's and still unhoused. Returns the updated row, or null when it wasn't
  // eligible (not owned / already housed). No lease is created here.
  async assignToProperty(
    landlordId: string,
    tenantId: string,
    propertyId: string,
  ) {
    const { data: prop, error: propErr } = await this.supabase.db
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("landlord_id", landlordId)
      .maybeSingle();
    if (propErr) throw propErr;
    if (!prop) throw new Error("property not found");

    const { data: top, error: slotErr } = await this.supabase.db
      .from("tenants")
      .select("tenant_slot")
      .eq("property_id", propertyId)
      .order("tenant_slot", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (slotErr) throw slotErr;
    const nextSlot = (top?.tenant_slot ?? 0) + 1;

    const { data, error } = await this.supabase.db
      .from("tenants")
      .update({
        property_id: propertyId,
        tenant_slot: nextSlot,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId)
      .eq("landlord_id", landlordId)
      .is("property_id", null)
      .select(TENANT_SELECT)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // Propose a transfer for the tenant to confirm — inserts a pending request, moving
  // nothing yet. The function verifies ownership + active lease + destination and
  // that no request is already pending; it raises on any precondition failure.
  async createTransferRequestViaAtomicRpc(
    landlordId: string,
    tenantId: string,
    toPropertyId: string,
  ): Promise<string> {
    const { data, error } = await this.supabase.db.rpc(
      "create_transfer_request_atomic",
      { p_landlord_id: landlordId, p_payload: { tenantId, toPropertyId } },
    );
    if (error) throw error;
    if (
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      typeof data.requestId === "string"
    ) {
      return data.requestId;
    }
    throw new Error(
      "create_transfer_request_atomic returned an unexpected result",
    );
  }

  async findRequest(requestId: string): Promise<TransferRequest | null> {
    const { data, error } = await this.supabase.db
      .from("tenant_transfer_requests")
      .select(REQUEST_ROW_COLS)
      .eq("id", requestId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const [hydrated] = await this.hydrate([data]);
    return hydrated ?? null;
  }

  async findPendingByLandlord(landlordId: string): Promise<TransferRequest[]> {
    const { data: tenants, error: tErr } = await this.supabase.db
      .from("tenants")
      .select("id")
      .eq("landlord_id", landlordId);
    if (tErr) throw tErr;
    const tenantIds = (tenants ?? []).map((t) => t.id);
    if (tenantIds.length === 0) return [];

    const { data, error } = await this.supabase.db
      .from("tenant_transfer_requests")
      .select(REQUEST_ROW_COLS)
      .in("tenant_id", tenantIds)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return this.hydrate(data ?? []);
  }

  // Cancel a pending request the landlord owns (via the tenant). Returns the updated
  // request, or null when nothing pending matched (not owned / already resolved) —
  // the service turns null into a 404.
  async cancelRequest(
    landlordId: string,
    requestId: string,
  ): Promise<TransferRequest | null> {
    const { data: req, error } = await this.supabase.db
      .from("tenant_transfer_requests")
      .select("id, tenant_id, status")
      .eq("id", requestId)
      .maybeSingle();
    if (error) throw error;
    if (!req || req.status !== "pending") return null;

    const owned = await this.findByIdForLandlord(landlordId, req.tenant_id);
    if (!owned) return null;

    const { error: uErr } = await this.supabase.db
      .from("tenant_transfer_requests")
      .update({ status: "cancelled", resolved_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("status", "pending");
    if (uErr) throw uErr;
    return this.findRequest(requestId);
  }

  // Resolve request rows to the DTO, batch-fetching tenant + property names so a list
  // stays a fixed number of queries.
  private async hydrate(
    rows: TransferRequestRow[],
  ): Promise<TransferRequest[]> {
    if (rows.length === 0) return [];
    const tenantIds = [...new Set(rows.map((r) => r.tenant_id))];
    const propIds = [
      ...new Set(
        rows
          .flatMap((r) => [r.from_property_id, r.to_property_id])
          .filter((id): id is string => id !== null),
      ),
    ];
    const [{ data: tenants }, { data: props }] = await Promise.all([
      this.supabase.db.from("tenants").select("id, tenant_name").in("id", tenantIds),
      this.supabase.db.from("properties").select("id, unit_name").in("id", propIds),
    ]);
    const tenantName = new Map((tenants ?? []).map((t) => [t.id, t.tenant_name]));
    const propName = new Map((props ?? []).map((p) => [p.id, p.unit_name]));

    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      tenantName: tenantName.get(r.tenant_id) ?? "",
      fromPropertyName: r.from_property_id
        ? propName.get(r.from_property_id) ?? null
        : null,
      toPropertyName: propName.get(r.to_property_id) ?? "",
      status: toTransferStatus(r.status),
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
    }));
  }
}
