import { Injectable } from "@nestjs/common";
import type { ReminderStatus } from "@unitko/shared";
import { SupabaseService } from "../supabase/supabase.service";

export interface ReminderContext {
  tenantName: string;
  email: string | null;
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
      .select("tenants(tenant_name, email), properties(unit_name, landlord_id)")
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
      email: tenant.email,
      propertyName: property.unit_name,
      dueDate: entry.due_date,
      amount: amountRow?.gross_due ?? 0,
    };
  }

  // Atomic once-per-day claim: inserts a 'pending' reminder_logs row and returns
  // its id, or null when today's slot is already held by an active attempt.
  async claim(
    landlordId: string,
    billingEntryId: string,
  ): Promise<string | null> {
    const { data, error } = await this.supabase.db.rpc("claim_tenant_reminder", {
      p_landlord_id: landlordId,
      p_billing_entry_id: billingEntryId,
      p_channel: "email",
    });
    if (error) throw error;
    return typeof data === "string" ? data : null;
  }

  // Settle a claimed reminder with the true dispatch outcome. sent_at is stamped
  // only on success; last_error carries the failure reason otherwise.
  async markResult(
    logId: string,
    status: Exclude<ReminderStatus, "pending">,
    sentAt: string | null,
    error: string | null,
  ): Promise<void> {
    const { error: dbErr } = await this.supabase.db
      .from("reminder_logs")
      .update({ status_code: status, sent_at: sentAt, last_error: error })
      .eq("id", logId);
    if (dbErr) throw dbErr;
  }
}
