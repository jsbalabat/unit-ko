import { Injectable } from "@nestjs/common";
import type { Json } from "@unitko/db";
import type { ActivityActionType } from "@unitko/shared";
import { SupabaseService } from "../supabase/supabase.service";

// Shape callers pass to log an activity. metadata is a JSON document.
export interface ActivityLogEntry {
  actionType: ActivityActionType;
  description: string;
  userId: string;
  propertyId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  metadata?: Json;
}

@Injectable()
export class ActivityRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async insert(entry: ActivityLogEntry): Promise<void> {
    const { error } = await this.supabase.db.from("activity_logs").insert({
      action_type_code: entry.actionType,
      description: entry.description,
      user_id: entry.userId,
      property_id: entry.propertyId ?? null,
      tenant_id: entry.tenantId ?? null,
      lease_id: entry.leaseId ?? null,
      metadata: entry.metadata ?? {},
    });
    if (error) throw error;
  }

  async findByLandlord(
    landlordId: string,
    propertyId: string | undefined,
    limit: number,
  ) {
    let query = this.supabase.db
      .from("activity_logs")
      .select(
        "id, action_type_code, description, property_id, tenant_id, lease_id, metadata, created_at, activity_action_types(label)",
      )
      .eq("user_id", landlordId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (propertyId) query = query.eq("property_id", propertyId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }
}
