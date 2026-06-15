import { z } from "zod";

// A tenant as shown in the landlord's tenant list / cards. `propertyId` null =
// unhoused (the "Unassigned" filter). Lease/billing live behind other endpoints.
export const tenantListItemSchema = z.object({
  id: z.string().uuid(),
  tenantName: z.string(),
  email: z.string().nullable(),
  contactNumber: z.string(),
  propertyId: z.string().uuid().nullable(),
  propertyName: z.string().nullable(),
  tenantSlot: z.number().int().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type TenantListItem = z.infer<typeof tenantListItemSchema>;

// POST /tenants — add a tenant. Omit/null propertyId for an unhoused tenant.
export const createTenantSchema = z.object({
  tenantName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200).nullable().optional(),
  contactNumber: z.string().trim().min(1).max(40),
  propertyId: z.string().uuid().nullable().optional(),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

// PATCH /tenants/:id — identity + active flag. Property (re)assignment is handled
// via the property update flow, not here.
export const updateTenantSchema = z.object({
  tenantName: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  contactNumber: z.string().trim().min(1).max(40).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

// GET /tenants?assigned=true|false — optional filter (housed vs unhoused).
// Query values are strings, so parse "true"/"false" explicitly (z.coerce.boolean
// would treat the string "false" as true).
export const listTenantsQuerySchema = z.object({
  assigned: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});
export type ListTenantsQuery = z.infer<typeof listTenantsQuerySchema>;
