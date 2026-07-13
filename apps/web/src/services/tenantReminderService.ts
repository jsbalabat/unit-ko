import { api, ApiError } from "@/lib/api-client";

interface ReminderPayload {
  tenantName: string;
  tenantPhone: string;
  propertyName: string;
  dueDate: string;
  totalAmount: number;
  billingEntryId: string;
}

// Sends a once-per-day rent reminder through the API, which rebuilds the message
// from trusted DB data and dispatches it by email via Zapier. The response carries
// the settled outcome: a 201 can still report status 'failed' (unconfigured webhook
// or a delivery error), which we surface as a failure rather than a false success.
export async function sendTenantReminder(payload: ReminderPayload): Promise<{
  success: boolean;
  message: string;
  alreadySentToday?: boolean;
}> {
  try {
    const result = await api.reminders.record({
      billingEntryId: payload.billingEntryId,
    });
    if (result.status === "sent") {
      return {
        success: true,
        message: `Reminder emailed to ${payload.tenantName}.`,
      };
    }
    return {
      success: false,
      message:
        result.error ??
        `The reminder to ${payload.tenantName} could not be delivered.`,
    };
  } catch (error) {
    // 429 = the once-per-day slot was already claimed today.
    if (error instanceof ApiError && error.status === 429) {
      return {
        success: false,
        alreadySentToday: true,
        message: "A reminder was already sent today for this invoice.",
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
