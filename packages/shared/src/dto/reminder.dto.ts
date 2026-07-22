import { z } from "zod";
import { REMINDER_CHANNELS, REMINDER_STATUSES } from "../enums";

// POST /reminders — send a once-per-day rent reminder for an invoice. The API
// resolves the recipient for the chosen channel from trusted DB data (never from
// the request), claims that channel's daily slot, dispatches via the matching
// Zapier webhook, and records the true outcome.
export const recordReminderSchema = z.object({
  billingEntryId: z.string().uuid(),
  channel: z.enum(REMINDER_CHANNELS).default("email"),
});

/** The parsed body: `channel` is always resolved by the time a handler sees it. */
export type RecordReminderInput = z.infer<typeof recordReminderSchema>;

/** The wire body a client sends — `channel` may be omitted and defaults to email. */
export type RecordReminderRequest = z.input<typeof recordReminderSchema>;

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

// GET /reminders — a recent reminder resolved to the tenant/property it concerns,
// for the dashboard's reminder-cycle feed. status/channel mirror the lookups;
// sent_at and error are populated once the dispatch settles.
export const reminderLogSchema = z.object({
  id: z.string(),
  status: z.enum(REMINDER_STATUSES),
  channel: z.enum(REMINDER_CHANNELS),
  tenantName: z.string().nullable(),
  propertyName: z.string().nullable(),
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  sentAt: z.string().nullable(),
  error: z.string().nullable(),
});
export type ReminderLog = z.infer<typeof reminderLogSchema>;
