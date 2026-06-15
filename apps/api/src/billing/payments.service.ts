import { Injectable, NotFoundException } from "@nestjs/common";
import type { PaymentRecord, RecordPaymentInput, RecordPaymentResult } from "@unitko/shared";
import { BillingService } from "./billing.service";
import { PaymentsRepository, type PaymentRow } from "./payments.repository";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository,
    private readonly billing: BillingService,
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
