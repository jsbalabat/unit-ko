import { Injectable, NotFoundException } from "@nestjs/common";
import type { PaymentRecord, RecordPaymentInput, RecordPaymentResult } from "@unitko/shared";
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
    const { paymentId, billingEntryId } = await this.repo.recordViaAtomicRpc(
      landlordId,
      input,
    );

    const paymentRow = await this.repo.findById(paymentId);
    if (!paymentRow) {
      throw new NotFoundException("Payment not found after recording");
    }

    await this.activity.log({
      actionType: "payment_made",
      description: `Payment recorded: ₱${paymentRow.amount}`,
      userId: landlordId,
      tenantId: paymentRow.tenant_id,
      leaseId: paymentRow.lease_id,
      metadata: { amount: paymentRow.amount, billingEntryId },
    });

    // The invoice (if any) re-read through the derived view, so the response
    // already reflects the new paidAmount/balance/status.
    const entry = billingEntryId
      ? await this.billing.getEntryDetail(billingEntryId)
      : null;

    return { payment: this.toPaymentRecord(paymentRow), entry };
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
