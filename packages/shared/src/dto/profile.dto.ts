import { z } from "zod";
import { ROLES } from "../enums";
import { payoutChannelSchema } from "./payout.dto";

// The signed-in landlord's own profile: identity (from profiles) + their payout
// channels (from landlord_payout_methods). Email is read-only here — it changes
// via Supabase Auth, not this endpoint.
export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  fullName: z.string().nullable(),
  username: z.string().nullable(),
  phone: z.string().nullable(),
  role: z.enum(ROLES),
  createdAt: z.string(),
  payoutMethods: z.array(payoutChannelSchema),
});
export type Profile = z.infer<typeof profileSchema>;

// PUT /profile — update identity and/or replace the payout-channel set. A
// present `payoutMethods` replaces all channels (the API sends the full desired
// set); omit it to leave channels untouched.
export const updateProfileSchema = z.object({
  fullName: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  payoutMethods: z.array(payoutChannelSchema).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
