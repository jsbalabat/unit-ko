import type { ReminderChannel } from "./enums";

/**
 * The exact rent-reminder text for a channel, shared by the API (what it actually
 * dispatches) and the web confirm dialog (the preview) so the two can never drift.
 *
 * SMS uses "PHP" rather than "₱": U+20B1 is outside GSM-7, so a single peso sign
 * forces the whole message to UCS-2 and cuts the per-segment budget from 160
 * characters to 70 — a one-segment reminder would start billing as two.
 */
export function buildReminderMessage(
  channel: ReminderChannel,
  tenantName: string,
  propertyName: string,
  dueDate: string | null,
  amount: number,
): string {
  const amountStr = amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (channel === "sms") {
    const shortDate = dueDate
      ? new Date(dueDate).toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
        })
      : null;
    const due = shortDate ? `is due ${shortDate}` : "is due soon";
    return `Hi ${tenantName}, rent for ${propertyName} (PHP ${amountStr}) ${due}. Please settle. Thank you!`;
  }

  const formattedDate = dueDate
    ? new Date(dueDate).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "the due date";
  return `Hi ${tenantName}, your rent for ${propertyName} is due on ${formattedDate} with a total amount of ₱${amountStr}. Please settle your account. Thank you!`;
}
