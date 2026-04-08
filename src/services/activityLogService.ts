import { supabase } from "@/lib/supabase";
import { z } from "zod";

// Canonical action types for activity logging
const CANONICAL_ACTION_TYPES = [
  "property_created",
  "property_updated",
  "tenant_added",
  "tenant_updated",
  "payment_made",
  "billing_updated",
  "property_reset",
  "property_note_added",
  "property_note_updated",
  "property_note_deleted",
  "tenant_reminder_sent",
  "legacy_event",
] as const;

// Zod schema for activity log payload validation
const activityLogSchema = z.object({
  propertyId: z.string().uuid("propertyId must be a valid UUID").optional().nullable(),
  actionType: z.enum(CANONICAL_ACTION_TYPES, {
    errorMap: () => ({
      message: `actionType must be one of: ${CANONICAL_ACTION_TYPES.join(", ")}`,
    }),
  }),
  description: z
    .string()
    .min(1, "description cannot be empty")
    .max(500, "description cannot exceed 500 characters"),
  tenantId: z.string().uuid("tenantId must be a valid UUID").optional().nullable(),
  metadata: z
    .record(z.unknown())
    .optional()
    .default({}),
});

interface ActivityLogPayload {
  propertyId?: string;
  actionType: string;
  description: string;
  tenantId?: string | null;
  metadata?: Record<string, unknown>;
}

interface ActivityLogResult {
  success: boolean;
  error?: string;
}

export async function logActivity(payload: ActivityLogPayload): Promise<ActivityLogResult> {
  try {
    // Validate payload using zod
    const validationResult = activityLogSchema.safeParse(payload);

    if (!validationResult.success) {
      const errorMessage = `Activity log validation failed: ${validationResult.error.errors[0].message}`;
      console.error(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }

    const validatedPayload = validationResult.data;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("activity_logs").insert({
      property_id: validatedPayload.propertyId ?? null,
      tenant_id: validatedPayload.tenantId ?? null,
      user_id: user?.id ?? null,
      action_type: validatedPayload.actionType,
      description: validatedPayload.description,
      metadata: validatedPayload.metadata ?? {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      const errorMessage = `Failed to write activity log: ${error.message}`;
      console.error(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = `Unexpected activity log error: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
