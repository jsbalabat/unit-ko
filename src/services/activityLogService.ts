import { supabase } from "@/lib/supabase";

interface ActivityLogPayload {
  propertyId?: string;
  actionType: string;
  description: string;
  tenantId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logActivity(payload: ActivityLogPayload): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("activity_logs").insert({
      property_id: payload.propertyId ?? null,
      tenant_id: payload.tenantId ?? null,
      user_id: user?.id ?? null,
      action_type: payload.actionType,
      description: payload.description,
      metadata: payload.metadata ?? {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Failed to write activity log:", error);
    }
  } catch (error) {
    console.error("Unexpected activity log error:", error);
  }
}
