import { z } from "zod";

// POST /reminders — record a once-per-day rent reminder for an invoice. SMS
// delivery (Zapier/UniSMS) is a separate, currently-paused integration; this
// endpoint records the reminder and returns the prepared message + recipient.
export const recordReminderSchema = z.object({
  billingEntryId: z.string().uuid(),
});
export type RecordReminderInput = z.infer<typeof recordReminderSchema>;

export const reminderResultSchema = z.object({
  recorded: z.literal(true),
  tenantName: z.string(),
  propertyName: z.string(),
  recipient: z.string(), // normalized E.164 phone
  dueDate: z.string().nullable(),
  amount: z.number(),
  message: z.string(),
});
export type ReminderResult = z.infer<typeof reminderResultSchema>;
