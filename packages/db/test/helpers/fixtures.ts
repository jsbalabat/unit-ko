import type { Tx } from "./client";

async function insertReturningId(
  tx: Tx,
  sql: string,
  params: unknown[],
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(sql, params);
  return rows[0].id;
}

/**
 * Create a landlord. Landlords are `auth.users` rows; the `on_auth_user_created`
 * trigger mints the matching `public.profiles` row that every other table FKs to.
 * A unique email per call keeps parallel workers off the citext unique index.
 */
export async function seedLandlord(tx: Tx): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into auth.users (id, email)
     values (gen_random_uuid(), 'lt-' || gen_random_uuid() || '@test.local')
     returning id`,
  );
  return rows[0].id;
}

export interface PropertyOverrides {
  unitName?: string;
  propertyType?: string | null;
  rentAmount?: number;
  maxTenants?: number;
  billingMode?: "unified" | "per_tenant";
}

export async function seedProperty(
  tx: Tx,
  landlordId: string,
  over: PropertyOverrides = {},
): Promise<string> {
  return insertReturningId(
    tx,
    `insert into public.properties
       (landlord_id, unit_name, property_type_code, rent_amount, max_tenants, billing_mode)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      landlordId,
      over.unitName ?? "Test Unit",
      over.propertyType ?? null,
      over.rentAmount ?? 0,
      over.maxTenants ?? 1,
      over.billingMode ?? "unified",
    ],
  );
}

export interface TenantOverrides {
  tenantName?: string;
  contactNumber?: string;
  isActive?: boolean;
  propertyId?: string | null;
}

export async function seedTenant(
  tx: Tx,
  landlordId: string,
  propertyId: string | null,
  over: TenantOverrides = {},
): Promise<string> {
  return insertReturningId(
    tx,
    `insert into public.tenants
       (landlord_id, property_id, tenant_name, contact_number, is_active)
     values ($1, $2, $3, $4, $5) returning id`,
    [
      landlordId,
      over.propertyId !== undefined ? over.propertyId : propertyId,
      over.tenantName ?? "Test Tenant",
      over.contactNumber ?? "09170000000",
      over.isActive ?? true,
    ],
  );
}

export interface LeaseOverrides {
  status?: "active" | "ended";
  rentAmount?: number;
  contractPeriods?: number | null;
  dueDay?: number | null;
  endReason?: string | null;
  endedAt?: string | null;
  rentStartDate?: string | null;
  rentEndDate?: string | null;
}

export async function seedLease(
  tx: Tx,
  propertyId: string,
  tenantId: string,
  over: LeaseOverrides = {},
): Promise<string> {
  return insertReturningId(
    tx,
    `insert into public.leases
       (property_id, tenant_id, status, rent_amount, contract_periods, due_day,
        end_reason, ended_at, rent_start_date, rent_end_date)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
    [
      propertyId,
      tenantId,
      over.status ?? "active",
      over.rentAmount ?? 0,
      over.contractPeriods ?? null,
      over.dueDay ?? null,
      over.endReason ?? null,
      over.endedAt ?? null,
      over.rentStartDate ?? null,
      over.rentEndDate ?? null,
    ],
  );
}

export interface EntryOverrides {
  dueDate?: string;
  rentDue?: number;
  sequence?: number;
}

export async function seedEntry(
  tx: Tx,
  leaseId: string,
  over: EntryOverrides = {},
): Promise<string> {
  return insertReturningId(
    tx,
    `insert into public.billing_entries
       (lease_id, due_date, rent_due, sequence)
     values ($1, $2, $3, $4) returning id`,
    [
      leaseId,
      over.dueDate ?? "2026-06-01",
      over.rentDue ?? 0,
      over.sequence ?? 1,
    ],
  );
}

export interface LeaseWithEntryOverrides {
  property?: PropertyOverrides;
  tenant?: TenantOverrides;
  lease?: LeaseOverrides;
  entry?: EntryOverrides;
}

export interface LeaseWithEntry {
  landlordId: string;
  propertyId: string;
  tenantId: string;
  leaseId: string;
  entryId: string;
}

/** Seed a property + tenant + active lease + one invoice for an existing landlord. */
export async function seedLeaseWithEntry(
  tx: Tx,
  landlordId: string,
  over: LeaseWithEntryOverrides = {},
): Promise<LeaseWithEntry> {
  const propertyId = await seedProperty(tx, landlordId, over.property);
  const tenantId = await seedTenant(tx, landlordId, propertyId, over.tenant);
  const leaseId = await seedLease(tx, propertyId, tenantId, over.lease);
  const entryId = await seedEntry(tx, leaseId, over.entry);
  return { landlordId, propertyId, tenantId, leaseId, entryId };
}

export async function addCharge(
  tx: Tx,
  entryId: string,
  amount: number,
  name = "Charge",
): Promise<string> {
  return insertReturningId(
    tx,
    `insert into public.billing_charges (billing_entry_id, name, amount)
     values ($1, $2, $3) returning id`,
    [entryId, name, amount],
  );
}

export interface DirectPayment {
  leaseId: string;
  tenantId: string;
  entryId?: string | null;
  amount: number;
  paymentType?: string;
}

/**
 * Insert a ledger row directly (bypassing record_payment_atomic) so view tests
 * can isolate the derivation formulas from the RPC's status recompute. Pass
 * `entryId: null` for a lease-level payment not tied to a specific invoice.
 */
export async function recordPaymentDirect(
  tx: Tx,
  p: DirectPayment,
): Promise<string> {
  return insertReturningId(
    tx,
    `insert into public.payments
       (billing_entry_id, lease_id, tenant_id, payment_type_code, amount)
     values ($1, $2, $3, $4, $5) returning id`,
    [p.entryId ?? null, p.leaseId, p.tenantId, p.paymentType ?? "rent", p.amount],
  );
}
