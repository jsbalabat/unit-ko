import type { BillingStatus } from "@unitko/shared";

// Mirror of the SQL billing_entry_status ladder (packages/db schemas/50_functions.sql).
// The server derives each invoice's status directly, so per-invoice reads should use
// the DTO's `status`. Only consolidated rows — several invoices merged for one billing
// period in the property view — lack a per-row server status, so the same ladder runs
// against their summed amounts here. Keep this in lockstep with the SQL function.
//
// Ladder (first match wins): nothing billed → Not Yet Set; balance cleared (cash or
// applied credit) → Paid; anything paid with a balance left → Partial; unpaid and past
// the due date → Overdue; otherwise → Not Yet Due.
export function billingStatusOf(
  grossDue: number,
  effectivePaid: number,
  balance: number,
  dueDate: string,
): BillingStatus {
  const epsilon = 0.01;
  if (grossDue <= epsilon) return "Not Yet Set";
  if (balance <= epsilon) return "Paid";
  if (effectivePaid > epsilon) return "Partial";
  if (isPastDue(dueDate)) return "Overdue";
  return "Not Yet Due";
}

// True when dueDate (a `yyyy-mm-dd` string) is strictly before today, compared whole-day
// in local time — the mirror of the SQL `p_due < current_date`. Parsed component-wise so
// a bare date isn't read as UTC midnight (which would shift a day in negative offsets).
function isPastDue(dueDate: string): boolean {
  if (!dueDate) return false;
  const [year, month, day] = dueDate.split("-").map(Number);
  if (!year || !month || !day) return false;
  const due = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}
