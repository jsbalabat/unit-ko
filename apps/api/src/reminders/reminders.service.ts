import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { RecordReminderInput, ReminderResult } from "@unitko/shared";
import { RemindersRepository } from "./reminders.repository";

@Injectable()
export class RemindersService {
  constructor(private readonly repo: RemindersRepository) {}

  async record(
    landlordId: string,
    input: RecordReminderInput,
  ): Promise<ReminderResult> {
    const ctx = await this.repo.resolveContext(landlordId, input.billingEntryId);
    if (!ctx) {
      throw new NotFoundException("Billing entry not found");
    }

    // Validate the phone BEFORE claiming, so an invalid number doesn't burn the
    // once-per-day slot.
    const recipient = normalizePhoneToE164(ctx.contactNumber);
    if (!recipient) {
      throw new UnprocessableEntityException(
        "Tenant contact number must be a valid PH mobile number (e.g. +639XXXXXXXXX or 09XXXXXXXXX).",
      );
    }

    const claimed = await this.repo.claimForToday(landlordId, input.billingEntryId);
    if (!claimed) {
      throw new HttpException(
        "A reminder was already sent today for this invoice.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return {
      recorded: true,
      tenantName: ctx.tenantName,
      propertyName: ctx.propertyName,
      recipient,
      dueDate: ctx.dueDate,
      amount: ctx.amount,
      message: buildReminderMessage(ctx.tenantName, ctx.propertyName, ctx.dueDate, ctx.amount),
    };
  }
}

// Ported from the legacy reminder route. Accepts common PH mobile formats and
// returns +639XXXXXXXXX, or null if it isn't a valid PH mobile number.
function normalizePhoneToE164(phone: string): string | null {
  const trimmed = phone.trim();
  const digitsOnly = phone.replace(/\D/g, "");
  if (/^\+639\d{9}$/.test(trimmed)) return trimmed;
  if (/^09\d{9}$/.test(digitsOnly)) return `+63${digitsOnly.slice(1)}`;
  if (/^9\d{9}$/.test(digitsOnly)) return `+63${digitsOnly}`;
  if (/^639\d{9}$/.test(digitsOnly)) return `+${digitsOnly}`;
  return null;
}

function buildReminderMessage(
  tenantName: string,
  propertyName: string,
  dueDate: string | null,
  amount: number,
): string {
  const formattedDate = dueDate
    ? new Date(dueDate).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "the due date";
  const amountStr = amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Hi ${tenantName}, your rent for ${propertyName} is due on ${formattedDate} with a total amount of ₱${amountStr}. Please settle your account. Thank you!`;
}
