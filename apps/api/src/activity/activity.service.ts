import { Injectable, Logger } from "@nestjs/common";
import type { Json } from "@unitko/db";
import {
  ACTIVITY_ACTION_TYPES,
  type ActivityActionType,
  type ActivityLog,
  type ListActivityQuery,
} from "@unitko/shared";
import { ActivityRepository, type ActivityLogEntry } from "./activity.repository";

// activity_logs row as selected (snake_case + embedded action label).
interface ActivityRow {
  id: string;
  action_type_code: string;
  description: string;
  property_id: string | null;
  tenant_id: string | null;
  lease_id: string | null;
  metadata: Json;
  created_at: string;
  activity_action_types: { label: string } | null;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly repo: ActivityRepository) {}

  // Best-effort: a logging failure must never break the action that triggered it.
  async log(entry: ActivityLogEntry): Promise<void> {
    try {
      await this.repo.insert(entry);
    } catch (err) {
      this.logger.warn(
        `activity log failed (${entry.actionType}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async list(
    landlordId: string,
    query: ListActivityQuery,
  ): Promise<ActivityLog[]> {
    const rows = await this.repo.findByLandlord(
      landlordId,
      query.propertyId,
      query.limit,
    );
    return rows.map((r) => this.toLog(r));
  }

  private toLog(r: ActivityRow): ActivityLog {
    return {
      id: r.id,
      actionType: toActionType(r.action_type_code),
      actionLabel: r.activity_action_types?.label ?? r.action_type_code,
      description: r.description,
      propertyId: r.property_id,
      tenantId: r.tenant_id,
      leaseId: r.lease_id,
      metadata: toRecord(r.metadata),
      createdAt: r.created_at,
    };
  }
}

function toActionType(code: string): ActivityActionType {
  for (const a of ACTIVITY_ACTION_TYPES) {
    if (a === code) return a;
  }
  return "legacy_event";
}

function toRecord(value: Json): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}
