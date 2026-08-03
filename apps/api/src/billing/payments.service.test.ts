import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { BillingEntry, RecordPaymentInput } from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import { BillingService } from "./billing.service";
import { PaymentsRepository, type PaymentRow } from "./payments.repository";
import { PaymentsService } from "./payments.service";

const stub = <T extends object>(impl: Partial<T>): T => impl as T;

const paymentRow = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  id: "pay1",
  billing_entry_id: "entry1",
  lease_id: "lease1",
  tenant_id: "tenant1",
  payment_type_code: "rent",
  amount: 1000,
  paid_at: "2026-06-01T00:00:00.000Z",
  notes: null,
  created_at: "2026-06-01T00:00:00.000Z",
  ...over,
});

const entry = (over: Partial<BillingEntry> = {}): BillingEntry => ({
  id: "entry1",
  leaseId: "lease1",
  periodId: null,
  tenantId: "tenant1",
  tenantName: "Ana Cruz",
  dueDate: "2026-06-01",
  rentDue: 1000,
  otherCharges: 0,
  grossDue: 1000,
  paidAmount: 1000,
  balance: 0,
  status: "Paid",
  sequence: 1,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  charges: [],
  ...over,
});

describe("PaymentsService.record", () => {
  const input: RecordPaymentInput = {
    billingEntryId: "entry1",
    amount: 1000,
    paymentType: "rent",
  };

  it("records via the RPC, logs the payment, and returns the refreshed invoice", async () => {
    const recordRpc = vi
      .fn<PaymentsRepository["recordViaAtomicRpc"]>()
      .mockResolvedValue({
        paymentId: "pay1",
        billingEntryId: "entry1",
        propertyId: "prop1",
        appliedCount: 1,
        creditAmount: 0,
      });
    const log = vi.fn<ActivityService["log"]>().mockResolvedValue(undefined);
    const getEntryDetail = vi
      .fn<BillingService["getEntryDetail"]>()
      .mockResolvedValue(entry());
    const repo = stub<PaymentsRepository>({
      recordViaAtomicRpc: recordRpc,
      findById: vi
        .fn<PaymentsRepository["findById"]>()
        .mockResolvedValue(paymentRow()),
    });
    const service = new PaymentsService(
      repo,
      stub<BillingService>({ getEntryDetail }),
      stub<ActivityService>({ log }),
    );

    const result = await service.record("landlord1", input);

    expect(recordRpc).toHaveBeenCalledWith("landlord1", input);
    expect(getEntryDetail).toHaveBeenCalledWith("entry1");
    expect(result.payment.id).toBe("pay1");
    expect(result.entry?.id).toBe("entry1");
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "payment_made",
        userId: "landlord1",
        propertyId: "prop1",
        tenantId: "tenant1",
        leaseId: "lease1",
      }),
    );
  });

  it("logs the full entered amount and the waterfall spread, not the first allocation", async () => {
    // The RPC returns the first allocation row (a fragment); the activity feed
    // must reflect the total the landlord entered and how far it spread.
    const log = vi.fn<ActivityService["log"]>().mockResolvedValue(undefined);
    const repo = stub<PaymentsRepository>({
      recordViaAtomicRpc: vi
        .fn<PaymentsRepository["recordViaAtomicRpc"]>()
        .mockResolvedValue({
          paymentId: "pay1",
          billingEntryId: "entry1",
          propertyId: "prop1",
          appliedCount: 2,
          creditAmount: 0,
        }),
      findById: vi
        .fn<PaymentsRepository["findById"]>()
        .mockResolvedValue(paymentRow({ amount: 300 })),
    });
    const service = new PaymentsService(
      repo,
      stub<BillingService>({
        getEntryDetail: vi
          .fn<BillingService["getEntryDetail"]>()
          .mockResolvedValue(entry()),
      }),
      stub<ActivityService>({ log }),
    );

    await service.record("landlord1", {
      billingEntryId: "entry1",
      amount: 500,
      paymentType: "rent",
    });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Payment recorded: ₱500 · applied across 2 periods",
        metadata: expect.objectContaining({ amount: 500, appliedCount: 2 }),
      }),
    );
  });

  it("returns a null entry for a lease-level payment not tied to an invoice", async () => {
    const getEntryDetail = vi.fn<BillingService["getEntryDetail"]>();
    const repo = stub<PaymentsRepository>({
      recordViaAtomicRpc: vi
        .fn<PaymentsRepository["recordViaAtomicRpc"]>()
        .mockResolvedValue({
          paymentId: "pay1",
          billingEntryId: null,
          propertyId: "prop1",
          appliedCount: 0,
          creditAmount: 0,
        }),
      findById: vi
        .fn<PaymentsRepository["findById"]>()
        .mockResolvedValue(paymentRow({ billing_entry_id: null })),
    });
    const service = new PaymentsService(
      repo,
      stub<BillingService>({ getEntryDetail }),
      stub<ActivityService>({
        log: vi.fn<ActivityService["log"]>().mockResolvedValue(undefined),
      }),
    );

    const result = await service.record("landlord1", {
      leaseId: "lease1",
      amount: 500,
      paymentType: "deposit",
    });

    expect(result.entry).toBeNull();
    expect(getEntryDetail).not.toHaveBeenCalled();
  });

  it("rejects with NotFound when the ledger row can't be read back", async () => {
    const repo = stub<PaymentsRepository>({
      recordViaAtomicRpc: vi
        .fn<PaymentsRepository["recordViaAtomicRpc"]>()
        .mockResolvedValue({
          paymentId: "pay1",
          billingEntryId: "entry1",
          propertyId: "prop1",
          appliedCount: 1,
          creditAmount: 0,
        }),
      findById: vi
        .fn<PaymentsRepository["findById"]>()
        .mockResolvedValue(null),
    });
    const service = new PaymentsService(
      repo,
      stub<BillingService>({}),
      stub<ActivityService>({
        log: vi.fn<ActivityService["log"]>().mockResolvedValue(undefined),
      }),
    );

    await expect(service.record("landlord1", input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe("PaymentsService.voidPayment", () => {
  const voidResult = {
    batchId: "batch1",
    leaseId: "lease1",
    tenantId: "tenant1",
    propertyId: "prop1",
    voidedCount: 2,
    entryIds: ["entry1", "entry2"],
  };

  it("voids via the RPC, logs the reversal, and returns the result", async () => {
    const voidRpc = vi
      .fn<PaymentsRepository["voidViaAtomicRpc"]>()
      .mockResolvedValue(voidResult);
    const log = vi.fn<ActivityService["log"]>().mockResolvedValue(undefined);
    const service = new PaymentsService(
      stub<PaymentsRepository>({ voidViaAtomicRpc: voidRpc }),
      stub<BillingService>({}),
      stub<ActivityService>({ log }),
    );

    const result = await service.voidPayment("landlord1", "batch1", {
      reason: "duplicate",
    });

    expect(voidRpc).toHaveBeenCalledWith("landlord1", "batch1", "duplicate");
    expect(result.voidedCount).toBe(2);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "payment_voided",
        userId: "landlord1",
        propertyId: "prop1",
        tenantId: "tenant1",
        leaseId: "lease1",
        metadata: expect.objectContaining({
          batchId: "batch1",
          voidedCount: 2,
          reason: "duplicate",
        }),
      }),
    );
  });

  it("maps an already-voided batch to a Conflict", async () => {
    const service = new PaymentsService(
      stub<PaymentsRepository>({
        voidViaAtomicRpc: vi
          .fn<PaymentsRepository["voidViaAtomicRpc"]>()
          .mockRejectedValue(new Error("payment already voided")),
      }),
      stub<BillingService>({}),
      stub<ActivityService>({ log: vi.fn<ActivityService["log"]>() }),
    );

    await expect(
      service.voidPayment("landlord1", "batch1", {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps another landlord's batch to NotFound and never logs", async () => {
    const log = vi.fn<ActivityService["log"]>().mockResolvedValue(undefined);
    const service = new PaymentsService(
      stub<PaymentsRepository>({
        voidViaAtomicRpc: vi
          .fn<PaymentsRepository["voidViaAtomicRpc"]>()
          .mockRejectedValue(new Error("not owned by landlord")),
      }),
      stub<BillingService>({}),
      stub<ActivityService>({ log }),
    );

    await expect(
      service.voidPayment("landlord1", "batch1", {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(log).not.toHaveBeenCalled();
  });
});
