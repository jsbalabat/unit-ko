import { z } from "zod";
import { BILLING_STATUSES, PAYMENT_TYPES } from "../enums";

// One charge line of an invoice. other_charges = SUM(amount) (derived).
export const billingChargeItemSchema = z.object({
  name: z.string(),
  amount: z.number(),
});
export type BillingChargeItem = z.infer<typeof billingChargeItemSchema>;

// An invoice with its DERIVED figures (from v_billing_entries_full) — never
// stored: otherCharges, grossDue, paidAmount, balance are computed sums.
export const billingEntrySchema = z.object({
  id: z.string().uuid(),
  leaseId: z.string().uuid().nullable(),
  periodId: z.string().uuid().nullable(),
  tenantId: z.string().uuid().nullable(),
  tenantName: z.string().nullable(),
  dueDate: z.string().nullable(),
  rentDue: z.number(),
  otherCharges: z.number(),
  grossDue: z.number(),
  paidAmount: z.number(),
  balance: z.number(),
  status: z.enum(BILLING_STATUSES),
  sequence: z.number().int().nullable(),
  // Nullable at the DTO level because the view erases the table's NOT NULL.
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  charges: z.array(billingChargeItemSchema),
});
export type BillingEntry = z.infer<typeof billingEntrySchema>;

// GET /billing/entries?propertyId=<uuid>
export const listBillingQuerySchema = z.object({
  propertyId: z.string().uuid(),
});
export type ListBillingQuery = z.infer<typeof listBillingQuerySchema>;

// PATCH /billing/entries/:id — edit one invoice. Only present sections change.
// `charges` (when present) replaces the full set → other_charges/gross_due stay
// derived. status is NOT settable: it's recomputed from the derived figures.
export const updateBillingEntrySchema = z.object({
  dueDate: z.string().date().optional(),
  rentDue: z.number().nonnegative().optional(),
  charges: z.array(billingChargeItemSchema).optional(),
});
export type UpdateBillingEntryInput = z.infer<typeof updateBillingEntrySchema>;

// ── Payments ────────────────────────────────────────────────────────────────
// POST /payments — pay against an invoice (billingEntryId) or a lease directly
// (e.g. a deposit/advance not tied to a period). At least one id is required.
export const recordPaymentSchema = z
  .object({
    billingEntryId: z.string().uuid().optional(),
    leaseId: z.string().uuid().optional(),
    amount: z.number().positive(),
    paymentType: z.enum(PAYMENT_TYPES).default("rent"),
    paidAt: z.string().datetime().optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => Boolean(v.billingEntryId) || Boolean(v.leaseId), {
    message: "billingEntryId or leaseId is required",
  });
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const paymentRecordSchema = z.object({
  id: z.string().uuid(),
  billingEntryId: z.string().uuid().nullable(),
  leaseId: z.string().uuid(),
  tenantId: z.string().uuid(),
  paymentType: z.string(),
  amount: z.number(),
  paidAt: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;

// POST /payments returns the ledger row + the refreshed invoice (when one applies).
export const recordPaymentResultSchema = z.object({
  payment: paymentRecordSchema,
  entry: billingEntrySchema.nullable(),
});
export type RecordPaymentResult = z.infer<typeof recordPaymentResultSchema>;
