import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { z } from "zod";
import {
  REMINDER_CHANNELS,
  REMINDER_STATUSES,
  type RecordReminderInput,
  type ReminderChannel,
  type ReminderLog,
  type ReminderResult,
  type ReminderStatus,
} from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import { ReminderDispatcher } from "./reminder-dispatcher.service";
import {
  RemindersRepository,
  type ReminderContext,
  type ReminderLogView,
} from "./reminders.repository";

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

    const { channel } = input;
    // Validate the recipient BEFORE claiming, so an unusable address doesn't burn
    // the once-per-day slot for this channel.
    const recipient = resolveRecipient(channel, ctx);
    if (!recipient) {
      throw new UnprocessableEntityException(
        channel === "sms"
          ? "A valid mobile number (e.g. 09171234567) is required to send an SMS reminder."
          : "Tenant email is required to send an email reminder.",
      );
    }

    const logId = await this.repo.claim(
      landlordId,
      input.billingEntryId,
      channel,
    );
    if (!logId) {
      throw new HttpException(
        `A ${channel === "sms" ? "text" : "email"} reminder was already sent today for this invoice.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Claim recorded a 'pending' row; dispatch, then settle it with the REAL
    // outcome (never optimistically 'sent'). A failed send is a 200 with
    // status 'failed', not an exception — the landlord sees it and can retry.
    const message = buildReminderMessage(
      channel,
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
      channel,
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
        ? `Reminder ${channel === "sms" ? "texted" : "emailed"} to ${ctx.tenantName}`
        : `Reminder to ${ctx.tenantName} failed to send`,
      userId: landlordId,
      metadata: {
        billingEntryId: input.billingEntryId,
        recipient,
        channel,
        status,
        error: outcome.error,
      },
    });

    return {
      status,
      channel,
      tenantName: ctx.tenantName,
      propertyName: ctx.propertyName,
      recipient,
      dueDate: ctx.dueDate,
      amount: ctx.amount,
      message,
      error: outcome.error,
    };
  }

  async listRecent(landlordId: string, limit?: number): Promise<ReminderLog[]> {
    const requested =
      typeof limit === "number" && Number.isFinite(limit) ? limit : 10;
    const capped = Math.min(Math.max(requested, 1), 50);
    const rows = await this.repo.findRecentByLandlord(landlordId, capped);
    return rows
      .filter((r): r is ReminderLogView & { id: string } => r.id !== null)
      .map((r) => ({
        id: r.id,
        status: toReminderStatus(r.status_code),
        channel: toReminderChannel(r.channel_code),
        tenantName: r.tenant_name,
        propertyName: r.property_name,
        dueDate: r.due_date,
        createdAt: r.created_at ?? "",
        sentAt: r.sent_at,
        error: r.last_error,
      }));
  }
}

// The address the chosen channel actually needs, taken from trusted DB data.
// null means "this tenant is unreachable on this channel" — a 422, not a send.
function resolveRecipient(
  channel: ReminderChannel,
  ctx: ReminderContext,
): string | null {
  return channel === "sms"
    ? normalizePhoneToE164(ctx.contactNumber)
    : normalizeEmail(ctx.email);
}

// Trim + validate the tenant's email; null if absent or malformed.
function normalizeEmail(email: string | null): string | null {
  const trimmed = email?.trim();
  if (!trimmed) return null;
  return z.string().email().safeParse(trimmed).success ? trimmed : null;
}

// contact_number is free-form (09xx…, +639xx…, spaces, dashes) but SMS gateways
// need E.164. PH mobiles are +63 followed by 9 and nine more digits; anything
// that doesn't reduce to that is rejected rather than guessed at, so the landlord
// gets a 422 they can fix instead of a message that silently goes nowhere.
function normalizePhoneToE164(contactNumber: string | null): string | null {
  const digits = contactNumber?.replace(/\D/g, "");
  if (!digits) return null;
  const subscriber = digits.startsWith("63")
    ? digits.slice(2)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  return /^9\d{9}$/.test(subscriber) ? `+63${subscriber}` : null;
}

function buildReminderMessage(
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
    // "PHP" rather than "₱": U+20B1 is outside GSM-7, so one peso sign would push
    // the whole message to UCS-2 and cut the per-segment budget from 160 to 70
    // characters — a one-segment reminder would start billing as two.
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

const REMINDER_STATUS_SET = new Set<string>(REMINDER_STATUSES);
const REMINDER_CHANNEL_SET = new Set<string>(REMINDER_CHANNELS);

function isReminderStatus(code: string): code is ReminderStatus {
  return REMINDER_STATUS_SET.has(code);
}

function isReminderChannel(code: string): code is ReminderChannel {
  return REMINDER_CHANNEL_SET.has(code);
}

// The feed view types status/channel as free strings; the base columns are
// FK-constrained to the lookups, so narrow defensively rather than trust blindly.
function toReminderStatus(code: string | null): ReminderStatus {
  return code !== null && isReminderStatus(code) ? code : "failed";
}

function toReminderChannel(code: string | null): ReminderChannel {
  return code !== null && isReminderChannel(code) ? code : "email";
}
