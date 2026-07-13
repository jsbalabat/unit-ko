import {
  HttpException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { RecordReminderInput } from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import { ReminderDispatcher } from "./reminder-dispatcher.service";
import { RemindersRepository, type ReminderContext } from "./reminders.repository";
import { RemindersService } from "./reminders.service";

const stub = <T extends object>(impl: Partial<T>): T => impl as T;

const ctx = (over: Partial<ReminderContext> = {}): ReminderContext => ({
  tenantName: "Ana Cruz",
  email: "ana@example.com",
  propertyName: "Unit 1",
  dueDate: "2026-07-01",
  amount: 1000,
  ...over,
});

const input: RecordReminderInput = { billingEntryId: "entry1" };

describe("RemindersService.record", () => {
  it("dispatches and marks the reminder sent on a successful webhook", async () => {
    const claim = vi
      .fn<RemindersRepository["claim"]>()
      .mockResolvedValue("log1");
    const markResult = vi
      .fn<RemindersRepository["markResult"]>()
      .mockResolvedValue(undefined);
    const send = vi
      .fn<ReminderDispatcher["send"]>()
      .mockResolvedValue({ ok: true, error: null });
    const log = vi.fn<ActivityService["log"]>().mockResolvedValue(undefined);
    const service = new RemindersService(
      stub<RemindersRepository>({
        resolveContext: vi
          .fn<RemindersRepository["resolveContext"]>()
          .mockResolvedValue(ctx()),
        claim,
        markResult,
      }),
      stub<ReminderDispatcher>({ send }),
      stub<ActivityService>({ log }),
    );

    const result = await service.record("landlord1", input);

    expect(claim).toHaveBeenCalledWith("landlord1", "entry1");
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        reminderLogId: "log1",
        recipient: "ana@example.com",
        channel: "email",
      }),
    );
    expect(markResult).toHaveBeenCalledWith(
      "log1",
      "sent",
      expect.any(String),
      null,
    );
    expect(result.status).toBe("sent");
    expect(result.error).toBeNull();
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "tenant_reminder_sent",
        metadata: expect.objectContaining({ status: "sent" }),
      }),
    );
  });

  it("marks the reminder failed (still resolving) when the webhook fails", async () => {
    const markResult = vi
      .fn<RemindersRepository["markResult"]>()
      .mockResolvedValue(undefined);
    const service = new RemindersService(
      stub<RemindersRepository>({
        resolveContext: vi
          .fn<RemindersRepository["resolveContext"]>()
          .mockResolvedValue(ctx()),
        claim: vi.fn<RemindersRepository["claim"]>().mockResolvedValue("log1"),
        markResult,
      }),
      stub<ReminderDispatcher>({
        send: vi
          .fn<ReminderDispatcher["send"]>()
          .mockResolvedValue({ ok: false, error: "Webhook responded 500" }),
      }),
      stub<ActivityService>({
        log: vi.fn<ActivityService["log"]>().mockResolvedValue(undefined),
      }),
    );

    const result = await service.record("landlord1", input);

    expect(result.status).toBe("failed");
    expect(result.error).toBe("Webhook responded 500");
    expect(markResult).toHaveBeenCalledWith(
      "log1",
      "failed",
      null,
      "Webhook responded 500",
    );
  });

  it("rejects with 422 when the tenant has no email, without claiming", async () => {
    const claim = vi.fn<RemindersRepository["claim"]>();
    const service = new RemindersService(
      stub<RemindersRepository>({
        resolveContext: vi
          .fn<RemindersRepository["resolveContext"]>()
          .mockResolvedValue(ctx({ email: null })),
        claim,
      }),
      stub<ReminderDispatcher>({}),
      stub<ActivityService>({}),
    );

    await expect(service.record("landlord1", input)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(claim).not.toHaveBeenCalled();
  });

  it("rejects with 429 when the daily slot is already claimed", async () => {
    const send = vi.fn<ReminderDispatcher["send"]>();
    const service = new RemindersService(
      stub<RemindersRepository>({
        resolveContext: vi
          .fn<RemindersRepository["resolveContext"]>()
          .mockResolvedValue(ctx()),
        claim: vi.fn<RemindersRepository["claim"]>().mockResolvedValue(null),
      }),
      stub<ReminderDispatcher>({ send }),
      stub<ActivityService>({}),
    );

    await expect(service.record("landlord1", input)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects with 404 when the invoice isn't found or owned", async () => {
    const service = new RemindersService(
      stub<RemindersRepository>({
        resolveContext: vi
          .fn<RemindersRepository["resolveContext"]>()
          .mockResolvedValue(null),
      }),
      stub<ReminderDispatcher>({}),
      stub<ActivityService>({}),
    );

    await expect(service.record("landlord1", input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe("RemindersService.listRecent", () => {
  it("maps feed rows to DTOs, dropping null-id rows", async () => {
    const findRecentByLandlord = vi
      .fn<RemindersRepository["findRecentByLandlord"]>()
      .mockResolvedValue([
        {
          id: "r1",
          status_code: "sent",
          channel_code: "email",
          last_error: null,
          created_at: "2026-07-13T09:00:00.000Z",
          sent_at: "2026-07-13T09:00:01.000Z",
          due_date: "2026-07-01",
          tenant_name: "Ana Cruz",
          property_name: "Unit 1",
        },
        {
          id: null,
          status_code: "sent",
          channel_code: "email",
          last_error: null,
          created_at: "2026-07-13T08:00:00.000Z",
          sent_at: null,
          due_date: null,
          tenant_name: null,
          property_name: null,
        },
      ]);
    const service = new RemindersService(
      stub<RemindersRepository>({ findRecentByLandlord }),
      stub<ReminderDispatcher>({}),
      stub<ActivityService>({}),
    );

    const result = await service.listRecent("landlord1", 5);

    expect(findRecentByLandlord).toHaveBeenCalledWith("landlord1", 5);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "r1",
      status: "sent",
      channel: "email",
      tenantName: "Ana Cruz",
      propertyName: "Unit 1",
      dueDate: "2026-07-01",
    });
  });

  it("falls back to 'failed' for an unrecognized status code", async () => {
    const service = new RemindersService(
      stub<RemindersRepository>({
        findRecentByLandlord: vi
          .fn<RemindersRepository["findRecentByLandlord"]>()
          .mockResolvedValue([
            {
              id: "r2",
              status_code: "bogus",
              channel_code: null,
              last_error: "boom",
              created_at: "2026-07-13T07:00:00.000Z",
              sent_at: null,
              due_date: null,
              tenant_name: "Bea",
              property_name: "Unit 2",
            },
          ]),
      }),
      stub<ReminderDispatcher>({}),
      stub<ActivityService>({}),
    );

    const result = await service.listRecent("landlord1");

    expect(result[0]?.status).toBe("failed");
    expect(result[0]?.channel).toBe("email");
  });
});
