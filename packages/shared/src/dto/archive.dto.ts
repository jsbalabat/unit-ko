import { z } from "zod";

// One archived tenancy, reconstructed from an ended lease + its relations
// (v_archived_tenants). `id` is the lease id. View columns are nullable.
export const archivedTenantSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid().nullable(),
  propertyName: z.string().nullable(),
  propertyType: z.string().nullable(),
  propertyLocation: z.string().nullable(),
  tenantName: z.string().nullable(),
  contactNumber: z.string().nullable(),
  contractMonths: z.number().int().nullable(),
  rentStartDate: z.string().nullable(),
  rentEndDate: z.string().nullable(),
  dueDay: z.number().int().nullable(),
  rentAmount: z.number().nullable(),
  totalPaid: z.number(),
  totalDue: z.number(),
  archiveReason: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
});
export type ArchivedTenant = z.infer<typeof archivedTenantSchema>;

// POST /archives — archive a tenant + reset their slot. remarks is required
// (>= 10 chars) and becomes the ended lease's end_reason.
export const archivePropertySchema = z.object({
  propertyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  remarks: z.string().trim().min(10).max(1000),
});
export type ArchivePropertyInput = z.infer<typeof archivePropertySchema>;

export const archiveResultSchema = z.object({
  archived: z.literal(true),
  leaseId: z.string().uuid().nullable(),
});
export type ArchiveResult = z.infer<typeof archiveResultSchema>;
