import { api, ApiError } from "@/lib/api-client";

interface ReminderPayload {
  tenantName: string;
  tenantPhone: string;
  propertyName: string;
  dueDate: string;
  totalAmount: number;
  billingEntryId: string;
}

// Records a once-per-day rent reminder through the API, which rebuilds the
// message from trusted DB data. Actual SMS dispatch (Zapier/UniSMS) is a
// separate, currently-paused integration — the endpoint records, it doesn't send.
export async function sendTenantReminder(payload: ReminderPayload): Promise<{
  success: boolean;
  message: string;
  alreadySentToday?: boolean;
}> {
  try {
    await api.reminders.record({ billingEntryId: payload.billingEntryId });
    return {
      success: true,
      message: `Reminder recorded for ${payload.tenantName}.`,
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
          : "Failed to record reminder. Please try again.",
    };
  }
}
