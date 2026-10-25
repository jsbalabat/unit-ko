import type {
  BillingChargeItem,
  BillingRevision,
  PaymentAllocation,
} from "@unitko/shared";
import { formatDateTime, peso } from "@/lib/format";

export { formatDateTime, peso };

export interface EditBillingPopupProps {
  propertyId: string;
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSwitchToProperty?: () => void;
}

export const PAYMENT_TYPE_OPTIONS = [
  { value: "rent", label: "Rent" },
  { value: "deposit", label: "Deposit" },
  { value: "advance", label: "Advance" },
] as const;

export type PaymentTypeValue = (typeof PAYMENT_TYPE_OPTIONS)[number]["value"];

export const STATUS_TONE: Record<string, string> = {
  Paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  Partial: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  Overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export function paymentTypeLabel(value: string): string {
  return PAYMENT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function chargesSignature(charges: BillingChargeItem[]): string {
  return charges.map((c) => `${c.name}:${c.amount}`).join("|");
}

export function sumCharges(charges: BillingChargeItem[]): number {
  return charges.reduce((total, c) => total + c.amount, 0);
}

// One row of the invoice history drawer: an edit revision or a payment.
export type HistoryItem =
  | { kind: "revision"; at: string; rev: BillingRevision }
  | { kind: "payment"; at: string; pay: PaymentAllocation };
