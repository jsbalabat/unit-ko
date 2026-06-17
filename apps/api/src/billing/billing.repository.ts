import { Injectable } from "@nestjs/common";
import type { BillingChargeItem, UpdateBillingEntryInput } from "@unitko/shared";
import { SupabaseService } from "../supabase/supabase.service";

// Derived figures come from the view; nothing here is a stored money column.
const ENTRY_SELECT =
  "id, lease_id, period_id, due_date, rent_due, status_code, sequence, other_charges, gross_due, paid_amount, balance";

// View rows are all-nullable at the type level (Postgres can't prove a view
// column non-null); the service narrows when mapping to the DTO.
export interface BillingEntryView {
  id: string | null;
  lease_id: string | null;
  period_id: string | null;
  due_date: string | null;
  rent_due: number | null;
  status_code: string | null;
  sequence: number | null;
  other_charges: number | null;
  gross_due: number | null;
  paid_amount: number | null;
  balance: number | null;
}

export interface EnrichedEntry {
  entry: BillingEntryView;
  tenantId: string | null;
  tenantName: string | null;
  charges: BillingChargeItem[];
}

@Injectable()
export class BillingRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async assertPropertyOwned(
    landlordId: string,
    propertyId: string,
  ): Promise<boolean> {
    const { data, error } = await this.supabase.db
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("landlord_id", landlordId)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  }

  async findEntriesByProperty(propertyId: string): Promise<EnrichedEntry[]> {
    const { data: leases, error: lErr } = await this.supabase.db
      .from("leases")
      .select("id, tenants(id, tenant_name)")
      .eq("property_id", propertyId);
    if (lErr) throw lErr;

    const leaseRows = leases ?? [];
    if (leaseRows.length === 0) return [];

    const tenantByLease = new Map<
      string,
      { id: string | null; name: string | null }
    >(
      leaseRows.map((l) => [
        l.id,
        { id: l.tenants?.id ?? null, name: l.tenants?.tenant_name ?? null },
      ]),
    );

    const { data: entries, error: eErr } = await this.supabase.db
      .from("v_billing_entries_full")
      .select(ENTRY_SELECT)
      .in(
        "lease_id",
        leaseRows.map((l) => l.id),
      )
      .order("due_date", { ascending: true });
    if (eErr) throw eErr;

    const rows = entries ?? [];
    const chargesByEntry = await this.fetchCharges(
      rows.map((r) => r.id).filter((id): id is string => id !== null),
    );

    return rows.map((entry) => {
      const tenant = entry.lease_id
        ? tenantByLease.get(entry.lease_id) ?? null
        : null;
      return {
        entry,
        tenantId: tenant?.id ?? null,
        tenantName: tenant?.name ?? null,
        charges: entry.id ? chargesByEntry.get(entry.id) ?? [] : [],
      };
    });
  }

  async findEntriesByLease(leaseId: string): Promise<EnrichedEntry[]> {
    const { data: lease, error: lErr } = await this.supabase.db
      .from("leases")
      .select("tenants(id, tenant_name)")
      .eq("id", leaseId)
      .maybeSingle();
    if (lErr) throw lErr;
    const tenantId = lease?.tenants?.id ?? null;
    const tenantName = lease?.tenants?.tenant_name ?? null;

    const { data: entries, error: eErr } = await this.supabase.db
      .from("v_billing_entries_full")
      .select(ENTRY_SELECT)
      .eq("lease_id", leaseId)
      .order("due_date", { ascending: true });
    if (eErr) throw eErr;

    const rows = entries ?? [];
    const chargesByEntry = await this.fetchCharges(
      rows.map((r) => r.id).filter((id): id is string => id !== null),
    );

    return rows.map((entry) => ({
      entry,
      tenantId,
      tenantName,
      charges: entry.id ? chargesByEntry.get(entry.id) ?? [] : [],
    }));
  }

  async findEntryDetailById(entryId: string): Promise<EnrichedEntry | null> {
    const { data: entry, error } = await this.supabase.db
      .from("v_billing_entries_full")
      .select(ENTRY_SELECT)
      .eq("id", entryId)
      .maybeSingle();
    if (error) throw error;
    if (!entry) return null;

    let tenantId: string | null = null;
    let tenantName: string | null = null;
    if (entry.lease_id) {
      const { data: lease, error: lErr } = await this.supabase.db
        .from("leases")
        .select("tenants(id, tenant_name)")
        .eq("id", entry.lease_id)
        .maybeSingle();
      if (lErr) throw lErr;
      tenantId = lease?.tenants?.id ?? null;
      tenantName = lease?.tenants?.tenant_name ?? null;
    }

    const chargesByEntry = await this.fetchCharges([entryId]);
    return { entry, tenantId, tenantName, charges: chargesByEntry.get(entryId) ?? [] };
  }

  // Edit + recompute happen inside the function (ownership is checked there too).
  async updateEntryViaAtomicRpc(
    landlordId: string,
    entryId: string,
    input: UpdateBillingEntryInput,
  ): Promise<void> {
    const { error } = await this.supabase.db.rpc("update_billing_entry_atomic", {
      p_landlord_id: landlordId,
      p_entry_id: entryId,
      p_payload: input,
    });
    if (error) throw error;
  }

  private async fetchCharges(
    entryIds: string[],
  ): Promise<Map<string, BillingChargeItem[]>> {
    const map = new Map<string, BillingChargeItem[]>();
    if (entryIds.length === 0) return map;

    const { data, error } = await this.supabase.db
      .from("billing_charges")
      .select("billing_entry_id, name, amount")
      .in("billing_entry_id", entryIds);
    if (error) throw error;

    for (const c of data ?? []) {
      const list = map.get(c.billing_entry_id) ?? [];
      list.push({ name: c.name, amount: c.amount });
      map.set(c.billing_entry_id, list);
    }
    return map;
  }
}
