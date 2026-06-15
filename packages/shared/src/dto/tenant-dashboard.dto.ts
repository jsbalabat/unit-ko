import { z } from "zod";
import { BILLING_FREQUENCIES } from "../enums";
import { billingEntrySchema } from "./billing.dto";

// GET /tenant/dashboard — what the logged-in tenant sees about their own tenancy.
// Behind the HMAC TenantSessionGuard; the tenant id comes from the cookie.
// lease/property are null if the tenant has no active lease (e.g. unhoused).
export const tenantDashboardSchema = z.object({
  tenant: z.object({
    id: z.string().uuid(),
    tenantName: z.string(),
    email: z.string().nullable(),
    contactNumber: z.string(),
  }),
  lease: z
    .object({
      id: z.string().uuid(),
      contractPeriods: z.number().int().nullable(),
      rentStartDate: z.string().nullable(),
      rentEndDate: z.string().nullable(),
      dueDay: z.number().int().nullable(),
      rentAmount: z.number(),
      billingFrequency: z.enum(BILLING_FREQUENCIES),
    })
    .nullable(),
  property: z
    .object({
      id: z.string().uuid(),
      unitName: z.string(),
      propertyType: z.string().nullable(),
      propertyLocation: z.string().nullable(),
      rentAmount: z.number(),
    })
    .nullable(),
  billingEntries: z.array(billingEntrySchema),
});
export type TenantDashboard = z.infer<typeof tenantDashboardSchema>;
