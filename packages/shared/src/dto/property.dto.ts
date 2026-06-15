import { z } from "zod";
import {
  BILLING_FREQUENCIES,
  BILLING_MODES,
  BILLING_STATUSES,
  OCCUPANCY_STATUSES,
} from "../enums";

// Empty strings from form inputs are coerced to null so optional date fields
// don't fail the strict YYYY-MM-DD check.
const optionalDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().date().nullable().optional(),
);

// One property as it appears in the landlord's list/dashboard. Occupancy and
// tenant count are derived (from active leases / the tenants table), never
// stored columns. `propertyType` is the lookup code; `propertyTypeLabel` is its
// human label resolved from the property_types table.
export const propertySummarySchema = z.object({
  id: z.string().uuid(),
  unitName: z.string(),
  propertyType: z.string().nullable(),
  propertyTypeLabel: z.string().nullable(),
  propertyLocation: z.string().nullable(),
  rentAmount: z.number(),
  maxTenants: z.number().int(),
  billingMode: z.enum(BILLING_MODES),
  leaseDate: z.string().nullable(),
  occupancyStatus: z.enum(OCCUPANCY_STATUSES),
  tenantCount: z.number().int(),
  createdAt: z.string(),
});
export type PropertySummary = z.infer<typeof propertySummarySchema>;

export const propertyNoteSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  authorId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PropertyNote = z.infer<typeof propertyNoteSchema>;

export const propertyAmenitySchema = z.object({
  code: z.string(),
  label: z.string(),
});
export type PropertyAmenity = z.infer<typeof propertyAmenitySchema>;

// Tenant identity as shown on a property card. Lease/billing details live behind
// the Leases/Billing endpoints, not here.
export const propertyTenantSchema = z.object({
  id: z.string().uuid(),
  tenantName: z.string(),
  email: z.string().nullable(),
  contactNumber: z.string(),
  tenantSlot: z.number().int().nullable(),
  isActive: z.boolean(),
});
export type PropertyTenant = z.infer<typeof propertyTenantSchema>;

export const propertyDetailSchema = propertySummarySchema.extend({
  notes: z.array(propertyNoteSchema),
  amenities: z.array(propertyAmenitySchema),
  tenants: z.array(propertyTenantSchema),
});
export type PropertyDetail = z.infer<typeof propertyDetailSchema>;

// ── Create property (POST /properties) ──────────────────────────────────────
// The request body for the atomic create. landlord_id is NOT here — it comes
// from the verified JWT, never the client.

// Lease terms shared by the tenants created with the property.
export const createPropertyLeaseSchema = z.object({
  billingFrequency: z.enum(BILLING_FREQUENCIES).default("monthly"),
  contractPeriods: z.number().int().positive().nullable().optional(),
  rentStartDate: optionalDate,
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  // Per-lease rent; falls back to the property's rentAmount when omitted.
  rentAmount: z.number().nonnegative().optional(),
  advancePayment: z.number().nonnegative().default(0),
  securityDeposit: z.number().nonnegative().default(0),
});

export const createPropertyTenantSchema = z.object({
  tenantName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200).nullable().optional(),
  contactNumber: z.string().trim().max(40).default(""),
});

export const createPropertyChargeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  amount: z.number(),
});

// One billing period. rentDue is applied per lease/invoice; charges become
// billing_charges rows so other_charges stays a derived SUM.
export const createPropertyBillingPeriodSchema = z.object({
  dueDate: z.string().date(),
  rentDue: z.number().nonnegative().default(0),
  status: z.enum(BILLING_STATUSES).optional(),
  charges: z.array(createPropertyChargeSchema).default([]),
});

export const createPropertySchema = z.object({
  unitName: z.string().trim().min(1).max(200),
  propertyType: z.string().trim().max(100).nullable().optional(),
  propertyLocation: z.string().trim().max(500).nullable().optional(),
  rentAmount: z.number().nonnegative().default(0),
  maxTenants: z.number().int().positive().default(1),
  billingMode: z.enum(BILLING_MODES).default("unified"),
  leaseDate: optionalDate,
  amenities: z.array(z.string()).default([]),
  lease: createPropertyLeaseSchema.default({}),
  tenants: z.array(createPropertyTenantSchema).default([]),
  billingSchedule: z.array(createPropertyBillingPeriodSchema).default([]),
});
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

// What create_property_atomic returns; the API uses propertyId to re-read detail.
export const createPropertyResultSchema = z.object({
  propertyId: z.string().uuid(),
  tenantCount: z.number().int(),
  billingEntryCount: z.number().int(),
});
export type CreatePropertyResult = z.infer<typeof createPropertyResultSchema>;
