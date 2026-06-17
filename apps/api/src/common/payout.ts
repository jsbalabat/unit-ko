import { PAYOUT_METHODS, type PayoutChannel, type PayoutMethod } from "@unitko/shared";

// landlord_payout_methods.method is a free `text` column (DB CHECK-constrained);
// narrow it to the PayoutMethod union and drop any row that falls outside it.
export function toPayoutChannel(row: {
  method: string;
  account_name: string | null;
  account_number: string | null;
  details: string | null;
}): PayoutChannel | null {
  if (!(PAYOUT_METHODS as readonly string[]).includes(row.method)) return null;
  return {
    method: row.method as PayoutMethod,
    accountName: row.account_name,
    accountNumber: row.account_number,
    details: row.details,
  };
}
