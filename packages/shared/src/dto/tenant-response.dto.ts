import { z } from "zod";
import { TENANT_RESPONSE_TYPES } from "../enums";

// POST /tenant/responses — a tenant acknowledges a specific bill with a response
// type (+ optional note). The tenant's identity comes from the session cookie,
// never the body.
export const createTenantResponseSchema = z.object({
  billingEntryId: z.string().uuid(),
  responseType: z.enum(TENANT_RESPONSE_TYPES),
  note: z.string().trim().max(500).optional(),
});
export type CreateTenantResponseInput = z.infer<
  typeof createTenantResponseSchema
>;

// A tenant's bill-response, resolved to the bill/tenant/property it concerns.
// Read on both sides: the tenant sees their own (GET /tenant/responses); the
// landlord reviews all of theirs (GET /responses) and stamps confirmedAt on receipt.
export const tenantResponseSchema = z.object({
  id: z.string(),
  billingEntryId: z.string(),
  responseType: z.enum(TENANT_RESPONSE_TYPES),
  responseTypeLabel: z.string(),
  note: z.string().nullable(),
  tenantName: z.string().nullable(),
  propertyName: z.string().nullable(),
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  confirmedAt: z.string().nullable(),
});
export type TenantResponse = z.infer<typeof tenantResponseSchema>;
