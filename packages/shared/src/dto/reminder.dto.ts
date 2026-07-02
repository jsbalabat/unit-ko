import { z } from "zod";
import { REMINDER_CHANNELS } from "../enums";

// POST /reminders — send a once-per-day rent reminder for an invoice. The API
// resolves the recipient from trusted DB data, claims the daily slot, dispatches
// via the Zapier webhook (email-first), and records the true outcome.
export const recordReminderSchema = z.object({
  billingEntryId: z.string().uuid(),
});
export type RecordReminderInput = z.infer<typeof recordReminderSchema>;

// The settled dispatch outcome (never 'pending' by the time the request returns).
// error carries the failure reason when status is 'failed'.
export const reminderResultSchema = z.object({
  status: z.enum(["sent", "failed"]),
  channel: z.enum(REMINDER_CHANNELS),
  tenantName: z.string(),
  propertyName: z.string(),
  recipient: z.string(),
  dueDate: z.string().nullable(),
  amount: z.number(),
  message: z.string(),
  error: z.string().nullable(),
});
export type ReminderResult = z.infer<typeof reminderResultSchema>;
