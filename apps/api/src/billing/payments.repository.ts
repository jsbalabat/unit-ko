import { Injectable } from "@nestjs/common";
import type { RecordPaymentInput } from "@unitko/shared";
import { SupabaseService } from "../supabase/supabase.service";

export interface PaymentRow {
  id: string;
  billing_entry_id: string | null;
  lease_id: string;
  tenant_id: string;
  payment_type_code: string;
  amount: number;
  paid_at: string;
  notes: string | null;
  created_at: string;
}

// What record_payment_atomic reports back. paymentId/billingEntryId are the
// first allocation (the payment can split into several ledger rows); propertyId
// + appliedCount + creditAmount describe the whole recorded payment for the log.
export interface RecordedPayment {
  paymentId: string;
  billingEntryId: string | null;
  propertyId: string | null;
  appliedCount: number;
  creditAmount: number;
}

@Injectable()
export class PaymentsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  // Ledger insert + invoice status refresh, atomically. The function resolves
  // lease/tenant and verifies ownership against the trusted landlord id.
  async recordViaAtomicRpc(
    landlordId: string,
    input: RecordPaymentInput,
  ): Promise<RecordedPayment> {
    const { data, error } = await this.supabase.db.rpc("record_payment_atomic", {
      p_landlord_id: landlordId,
      p_payload: input,
    });
    if (error) throw error;

    if (
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      typeof data.paymentId === "string"
    ) {
      return {
        paymentId: data.paymentId,
        billingEntryId:
          typeof data.billingEntryId === "string" ? data.billingEntryId : null,
        propertyId:
          typeof data.propertyId === "string" ? data.propertyId : null,
        appliedCount:
          typeof data.appliedCount === "number" ? data.appliedCount : 0,
        creditAmount:
          typeof data.creditAmount === "number" ? data.creditAmount : 0,
      };
    }
    throw new Error("record_payment_atomic returned an unexpected result");
  }

  async findById(paymentId: string): Promise<PaymentRow | null> {
    const { data, error } = await this.supabase.db
      .from("payments")
      .select(
        "id, billing_entry_id, lease_id, tenant_id, payment_type_code, amount, paid_at, notes, created_at",
      )
      .eq("id", paymentId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}
