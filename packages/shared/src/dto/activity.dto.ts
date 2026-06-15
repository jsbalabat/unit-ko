import { z } from "zod";
import { ACTIVITY_ACTION_TYPES } from "../enums";

// One activity-log entry. metadata is a genuine document (jsonb).
export const activityLogSchema = z.object({
  id: z.string().uuid(),
  actionType: z.enum(ACTIVITY_ACTION_TYPES),
  actionLabel: z.string(),
  description: z.string(),
  propertyId: z.string().uuid().nullable(),
  tenantId: z.string().uuid().nullable(),
  leaseId: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
});
export type ActivityLog = z.infer<typeof activityLogSchema>;

// GET /activity?propertyId=&limit=
export const listActivityQuerySchema = z.object({
  propertyId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;
