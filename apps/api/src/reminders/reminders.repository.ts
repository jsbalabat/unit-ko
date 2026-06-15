import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

export interface ReminderContext {
  tenantName: string;
  contactNumber: string;
  propertyName: string;
  dueDate: string | null;
  amount: number;
}

@Injectable()
export class RemindersRepository {
  constructor(private readonly supabase: SupabaseService) {}

  // Resolve the invoice's tenant/property/amount and verify the landlord owns it.
  // null = not found or not owned (the caller turns that into a 404).
  async resolveContext(
    landlordId: string,
    billingEntryId: string,
  ): Promise<ReminderContext | null> {
    const { data: entry, error } = await this.supabase.db
      .from("billing_entries")
      .select("id, due_date, lease_id")
      .eq("id", billingEntryId)
      .maybeSingle();
    if (error) throw error;
    if (!entry?.lease_id) return null;

    const { data: lease, error: lErr } = await this.supabase.db
      .from("leases")
      .select("tenants(tenant_name, contact_number), properties(unit_name, landlord_id)")
      .eq("id", entry.lease_id)
      .maybeSingle();
    if (lErr) throw lErr;

    const property = lease?.properties ?? null;
    const tenant = lease?.tenants ?? null;
    if (!property || property.landlord_id !== landlordId || !tenant) return null;

    const { data: amountRow, error: aErr } = await this.supabase.db
      .from("v_billing_entries_full")
      .select("gross_due")
      .eq("id", billingEntryId)
      .maybeSingle();
    if (aErr) throw aErr;

    return {
      tenantName: tenant.tenant_name,
      contactNumber: tenant.contact_number,
      propertyName: property.unit_name,
      dueDate: entry.due_date,
      amount: amountRow?.gross_due ?? 0,
    };
  }

  // Atomic once-per-day claim. Returns false if a reminder was already logged
  // for this invoice today.
  async claimForToday(
    landlordId: string,
    billingEntryId: string,
  ): Promise<boolean> {
    const { data, error } = await this.supabase.db.rpc("claim_tenant_reminder", {
      p_landlord_id: landlordId,
      p_billing_entry_id: billingEntryId,
    });
    if (error) throw error;
    return data === true;
  }
}
