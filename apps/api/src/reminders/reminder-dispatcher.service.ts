import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { REMINDER_CHANNELS } from "@unitko/shared";
import type { Env } from "../config/env";

// The JSON contract the API POSTs to the Zapier catch-hook (an api↔Zapier
// concern, not the FE/BE contract): the Zap maps these fields into the outgoing
// email. Kept as a schema so the payload is validated before it leaves the API.
const webhookPayloadSchema = z.object({
  event: z.literal("rent_due_today"),
  sentAt: z.string(),
  reminderLogId: z.string().uuid(),
  channel: z.enum(REMINDER_CHANNELS),
  recipient: z.string(),
  tenantName: z.string(),
  propertyName: z.string(),
  dueDate: z.string().nullable(),
  amount: z.number(),
  message: z.string(),
});
export type ReminderWebhookPayload = z.infer<typeof webhookPayloadSchema>;

export interface DispatchOutcome {
  ok: boolean;
  error: string | null;
}

// Outbound gateway for rent reminders. Isolated from the service so the external
// side effect (and the service-role-only webhook secret) lives in one place and
// is trivially stubbed in tests.
@Injectable()
export class ReminderDispatcher {
  private readonly logger = new Logger(ReminderDispatcher.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async send(payload: ReminderWebhookPayload): Promise<DispatchOutcome> {
    const url = this.config.get("ZAPIER_RENT_DUE_WEBHOOK", { infer: true });
    if (!url) {
      return {
        ok: false,
        error: "Reminder webhook is not configured (ZAPIER_RENT_DUE_WEBHOOK).",
      };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayloadSchema.parse(payload)),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return { ok: false, error: `Webhook responded ${res.status}` };
      }
      return { ok: true, error: null };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.warn(`reminder webhook failed: ${error}`);
      return { ok: false, error };
    }
  }
}
