import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  PaymentRecord,
  RecordPaymentInput,
  RecordPaymentResult,
  VoidPaymentInput,
  VoidPaymentResult,
} from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import { BillingService } from "./billing.service";
import { PaymentsRepository, type PaymentRow } from "./payments.repository";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository,
    private readonly billing: BillingService,
    private readonly activity: ActivityService,
  ) {}

  async record(
    landlordId: string,
    input: RecordPaymentInput,
  ): Promise<RecordPaymentResult> {
    const { paymentId, billingEntryId, propertyId, appliedCount, creditAmount } =
      await this.repo.recordViaAtomicRpc(landlordId, input);

    const paymentRow = await this.repo.findById(paymentId);
    if (!paymentRow) {
      throw new NotFoundException("Payment not found after recording");
    }

    // record_payment_atomic may split one payment into several ledger rows
    // (waterfall) and paymentRow is only the first; log the full amount the
    // landlord entered, not that fragment. propertyId attributes the entry so it
    // surfaces in the property's activity feed (which filters by property).
    const spread = appliedCount > 1 ? ` · applied across ${appliedCount} periods` : "";
    await this.activity.log({
      actionType: "payment_made",
      description: `Payment recorded: ₱${input.amount}${spread}`,
      userId: landlordId,
      propertyId,
      tenantId: paymentRow.tenant_id,
      leaseId: paymentRow.lease_id,
      metadata: { amount: input.amount, billingEntryId, appliedCount, creditAmount },
    });

    // The invoice (if any) re-read through the derived view, so the response
    // already reflects the new paidAmount/balance/status.
    const entry = billingEntryId
      ? await this.billing.getEntryDetail(billingEntryId)
      : null;

    return { payment: this.toPaymentRecord(paymentRow), entry };
  }

  // Reverse a recorded payment by voiding its whole batch. The RPC enforces
  // ownership and single-void; map its raised errors to the right HTTP status so
  // the client sees a 404/409 rather than an opaque 500.
  async voidPayment(
    landlordId: string,
    batchId: string,
    input: VoidPaymentInput,
  ): Promise<VoidPaymentResult> {
    let result: VoidPaymentResult;
    try {
      result = await this.repo.voidViaAtomicRpc(landlordId, batchId, input.reason);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/already voided/i.test(message)) {
        throw new ConflictException("Payment already voided");
      }
      if (/not owned by landlord|payment not found/i.test(message)) {
        throw new NotFoundException("Payment not found");
      }
      throw err;
    }

    await this.activity.log({
      actionType: "payment_voided",
      description: "Payment voided",
      userId: landlordId,
      propertyId: result.propertyId,
      tenantId: result.tenantId,
      leaseId: result.leaseId,
      metadata: {
        batchId: result.batchId,
        voidedCount: result.voidedCount,
        reason: input.reason ?? null,
      },
    });

    return result;
  }

  private toPaymentRecord(row: PaymentRow): PaymentRecord {
    return {
      id: row.id,
      billingEntryId: row.billing_entry_id,
      leaseId: row.lease_id,
      tenantId: row.tenant_id,
      paymentType: row.payment_type_code,
      amount: row.amount,
      paidAt: row.paid_at,
      notes: row.notes,
      createdAt: row.created_at,
    };
  }
}
