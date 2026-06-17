import { z } from "zod";
import { PAYOUT_METHODS } from "../enums";

// One payment-receiving channel a landlord exposes to their tenants. Account
// fields are nullable because which ones apply depends on the method (e.g. a
// `gcash` row uses accountNumber + accountName; `other` uses details only).
export const payoutChannelSchema = z.object({
  method: z.enum(PAYOUT_METHODS),
  accountName: z.string().nullable(),
  accountNumber: z.string().nullable(),
  details: z.string().nullable(),
});
export type PayoutChannel = z.infer<typeof payoutChannelSchema>;
