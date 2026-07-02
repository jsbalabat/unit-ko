import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";
import type { RecordReminderInput, ReminderResult } from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import { ReminderDispatcher } from "./reminder-dispatcher.service";
import { RemindersRepository } from "./reminders.repository";

@Injectable()
export class RemindersService {
  constructor(
    private readonly repo: RemindersRepository,
    private readonly dispatcher: ReminderDispatcher,
    private readonly activity: ActivityService,
  ) {}

  async record(
    landlordId: string,
    input: RecordReminderInput,
  ): Promise<ReminderResult> {
    const ctx = await this.repo.resolveContext(landlordId, input.billingEntryId);
    if (!ctx) {
      throw new NotFoundException("Billing entry not found");
    }

    // Validate the recipient BEFORE claiming, so a missing email doesn't burn the
    // once-per-day slot.
    const recipient = normalizeEmail(ctx.email);
    if (!recipient) {
      throw new UnprocessableEntityException(
        "Tenant email is required to send an email reminder.",
      );
    }

    const logId = await this.repo.claim(landlordId, input.billingEntryId);
    if (!logId) {
      throw new HttpException(
        "A reminder was already sent today for this invoice.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Claim recorded a 'pending' row; dispatch, then settle it with the REAL
    // outcome (never optimistically 'sent'). A failed send is a 200 with
    // status 'failed', not an exception — the landlord sees it and can retry.
    const message = buildReminderMessage(
      ctx.tenantName,
      ctx.propertyName,
      ctx.dueDate,
      ctx.amount,
    );
    const sentAt = new Date().toISOString();
    const outcome = await this.dispatcher.send({
      event: "rent_due_today",
      sentAt,
      reminderLogId: logId,
      channel: "email",
      recipient,
      tenantName: ctx.tenantName,
      propertyName: ctx.propertyName,
      dueDate: ctx.dueDate,
      amount: ctx.amount,
      message,
    });

    const status = outcome.ok ? "sent" : "failed";
    await this.repo.markResult(
      logId,
      status,
      outcome.ok ? sentAt : null,
      outcome.error,
    );

    await this.activity.log({
      actionType: "tenant_reminder_sent",
      description: outcome.ok
        ? `Reminder emailed to ${ctx.tenantName}`
        : `Reminder to ${ctx.tenantName} failed to send`,
      userId: landlordId,
      metadata: {
        billingEntryId: input.billingEntryId,
        recipient,
        channel: "email",
        status,
        error: outcome.error,
      },
    });

    return {
      status,
      channel: "email",
      tenantName: ctx.tenantName,
      propertyName: ctx.propertyName,
      recipient,
      dueDate: ctx.dueDate,
      amount: ctx.amount,
      message,
      error: outcome.error,
    };
  }
}

// Trim + validate the tenant's email; null if absent or malformed.
function normalizeEmail(email: string | null): string | null {
  const trimmed = email?.trim();
  if (!trimmed) return null;
  return z.string().email().safeParse(trimmed).success ? trimmed : null;
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
