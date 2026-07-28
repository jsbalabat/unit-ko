import { Injectable } from "@nestjs/common";
import type { ReminderChannel, ReminderStatus } from "@unitko/shared";
import { SupabaseService } from "../supabase/supabase.service";

export interface ReminderContext {
  tenantId: string;
  tenantName: string;
  email: string | null;
  contactNumber: string | null;
  propertyId: string;
  propertyName: string;
  dueDate: string | null;
  amount: number;
}

// A row from the feed view (v_reminder_logs_full). View columns are all-nullable
// at the type level (Postgres can't prove a view column non-null); the service
// narrows when mapping to the DTO.
export interface ReminderLogView {
  id: string | null;
  status_code: string | null;
  channel_code: string | null;
  last_error: string | null;
  created_at: string | null;
  sent_at: string | null;
  due_date: string | null;
  tenant_name: string | null;
  property_name: string | null;
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
      .select(
        "tenants(id, tenant_name, email, contact_number), properties(id, unit_name, landlord_id)",
      )
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
      tenantId: tenant.id,
      tenantName: tenant.tenant_name,
      email: tenant.email,
      contactNumber: tenant.contact_number,
      propertyId: property.id,
      propertyName: property.unit_name,
      dueDate: entry.due_date,
      amount: amountRow?.gross_due ?? 0,
    };
  }

  // Atomic once-per-day claim for one channel: inserts a 'pending' reminder_logs
  // row and returns its id, or null when that channel's slot for today is already
  // held by an active attempt. Email and SMS hold independent slots.
  async claim(
    landlordId: string,
    billingEntryId: string,
    channel: ReminderChannel,
  ): Promise<string | null> {
    const { data, error } = await this.supabase.db.rpc("claim_tenant_reminder", {
      p_landlord_id: landlordId,
      p_billing_entry_id: billingEntryId,
      p_channel: channel,
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

  // Recent reminders for a landlord via the feed view, already joined to
  // tenant/property and filterable by landlord_id. Newest first.
  async findRecentByLandlord(
    landlordId: string,
    limit: number,
  ): Promise<ReminderLogView[]> {
    const { data, error } = await this.supabase.db
      .from("v_reminder_logs_full")
      .select(
        "id, status_code, channel_code, last_error, created_at, sent_at, due_date, tenant_name, property_name",
      )
      .eq("landlord_id", landlordId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }
}
