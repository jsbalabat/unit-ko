import { api, ApiError } from "@/lib/api-client";
import type { ReminderChannel } from "@unitko/shared";

interface ReminderPayload {
  billingEntryId: string;
  tenantName: string;
  channel: ReminderChannel;
}

// Sends a once-per-day rent reminder on the chosen channel through the API, which
// rebuilds the message from trusted DB data and dispatches it via Zapier (email or
// SMS). The response carries the settled outcome: a 201 can still report status
// 'failed' (unconfigured webhook or a delivery error), surfaced as a failure
// rather than a false success.
export async function sendTenantReminder(payload: ReminderPayload): Promise<{
  success: boolean;
  message: string;
  alreadySentToday?: boolean;
}> {
  const { channel, tenantName } = payload;
  const verb = channel === "sms" ? "texted" : "emailed";
  try {
    const result = await api.reminders.record({
      billingEntryId: payload.billingEntryId,
      channel,
    });
    if (result.status === "sent") {
      return { success: true, message: `Reminder ${verb} to ${tenantName}.` };
    }
    return {
      success: false,
      message:
        result.error ?? `The reminder to ${tenantName} could not be delivered.`,
    };
  } catch (error) {
    // 429 = the once-per-day slot for this channel was already claimed today.
    if (error instanceof ApiError && error.status === 429) {
      return {
        success: false,
        alreadySentToday: true,
        message: `A ${channel === "sms" ? "text" : "email"} reminder was already sent today for this invoice.`,
      };
    }
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to send reminder. Please try again.",
    };
  }
}
