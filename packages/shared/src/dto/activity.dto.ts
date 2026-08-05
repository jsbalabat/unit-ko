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

// GET /activity?propertyId=&actionType=&before=&beforeId=&limit=
// The feed is keyset-paginated on (created_at desc, id desc): pass the last row's
// createdAt/id as before/beforeId to fetch the next (older) page. `before` is an
// opaque cursor echoed straight back from a prior row, so it isn't re-validated as
// a datetime here — the DB compares it as timestamptz. beforeId disambiguates rows
// that share a timestamp, so a page boundary can't skip one.
export const listActivityQuerySchema = z.object({
  propertyId: z.string().uuid().optional(),
  actionType: z.enum(ACTIVITY_ACTION_TYPES).optional(),
  before: z.string().optional(),
  beforeId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;
