import { z } from "zod";
import { TRANSFER_REQUEST_STATUSES } from "../enums";

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

// POST /tenants/:id/transfer — move the tenant to another of the landlord's
// properties, carrying the current lease's terms and its open invoice balances (the
// originals are marked transferred on the source). The tenant id comes from the path.
export const transferTenantSchema = z.object({
  toPropertyId: z.string().uuid(),
});
export type TransferTenantInput = z.infer<typeof transferTenantSchema>;

// The atomic result: the source/destination properties + leases and how many open
// invoices were carried forward, for the activity log and a confirmation toast.
export const transferTenantResultSchema = z.object({
  tenantId: z.string().uuid(),
  fromPropertyId: z.string().uuid(),
  toPropertyId: z.string().uuid(),
  fromLeaseId: z.string().uuid(),
  toLeaseId: z.string().uuid(),
  transferredCount: z.number().int(),
});
export type TransferTenantResult = z.infer<typeof transferTenantResultSchema>;

// POST /tenants/:id/assign — place a currently-unhoused tenant onto one of the
// landlord's properties (property_id + next slot). No lease is created here (there
// are no terms to carry); the lease/billing is set up from the property afterward,
// exactly as for a tenant added with a property. Returns the updated tenant.
export const assignTenantSchema = z.object({
  propertyId: z.string().uuid(),
});
export type AssignTenantInput = z.infer<typeof assignTenantSchema>;

// A tenant-transfer request in the landlord↔tenant handshake. Property names are
// resolved by the API for display. The landlord proposes (POST /tenants/:id/transfer
// now creates one of these instead of moving immediately), and the tenant confirms
// or rejects it; only a confirm actually moves the tenant.
export const transferRequestSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  fromPropertyName: z.string().nullable(),
  toPropertyName: z.string(),
  status: z.enum(TRANSFER_REQUEST_STATUSES),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
});
export type TransferRequest = z.infer<typeof transferRequestSchema>;

// POST /tenant/transfer-request/:id/resolve — the tenant confirms or rejects.
export const resolveTransferRequestSchema = z.object({
  confirm: z.boolean(),
});
export type ResolveTransferRequestInput = z.infer<
  typeof resolveTransferRequestSchema
>;
