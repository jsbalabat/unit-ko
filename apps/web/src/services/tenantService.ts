import { api } from "@/lib/api-client";
import type {
  PayoutChannel,
  TenantListItem,
  TransferRequest,
} from "@unitko/shared";

export interface CreateTenantInput {
  tenantName: string;
  tenantEmail?: string;
  contactNumber: string;
  propertyId?: string | null; // omit / null for an unhoused tenant
}

export interface CreateTenantResult {
  success: boolean;
  tenant?: TenantListItem;
  error?: string;
}

// Create a tenant via the API. With a propertyId the API validates ownership,
// assigns the next free slot, and flips the property to occupied; without one
// the tenant is created unhoused for later assignment.
export async function createTenant(
  input: CreateTenantInput,
): Promise<CreateTenantResult> {
  try {
    const tenant = await api.tenants.create({
      tenantName: input.tenantName.trim(),
      email: input.tenantEmail?.trim() || undefined,
      contactNumber: input.contactNumber.trim(),
      propertyId: input.propertyId ?? null,
    });
    return { success: true, tenant };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create tenant",
    };
  }
}

export interface UpdateTenantInput {
  tenantName: string;
  tenantEmail?: string | null; // "" / null clears the stored email
  contactNumber: string;
}

export interface UpdateTenantResult {
  success: boolean;
  tenant?: TenantListItem;
  error?: string;
}

// Edit a tenant's identity via the API. Property (re)assignment is deliberately
// not editable here — it flows through the property update path — so this only
// touches name, contact, and email. An empty email clears the stored value.
export async function updateTenant(
  id: string,
  input: UpdateTenantInput,
): Promise<UpdateTenantResult> {
  try {
    const email = input.tenantEmail?.trim();
    const tenant = await api.tenants.update(id, {
      tenantName: input.tenantName.trim(),
      email: email ? email : null,
      contactNumber: input.contactNumber.trim(),
    });
    return { success: true, tenant };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update tenant",
    };
  }
}

export interface TransferTenantOutcome {
  success: boolean;
  request?: TransferRequest;
  error?: string;
}

// Propose a transfer for the tenant to confirm — no move happens until they do. The
// current lease's terms and open invoice balances carry over on confirmation.
export async function transferTenant(
  id: string,
  toPropertyId: string,
): Promise<TransferTenantOutcome> {
  try {
    const request = await api.tenants.transfer(id, { toPropertyId });
    return { success: true, request };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to propose transfer",
    };
  }
}

// Withdraw a pending transfer proposal.
export async function cancelTransferRequest(
  requestId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await api.tenants.cancelTransferRequest(requestId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to cancel transfer",
    };
  }
}

export interface AssignTenantOutcome {
  success: boolean;
  tenant?: TenantListItem;
  error?: string;
}

// Place an unhoused tenant onto a property (no lease is created — see the API).
export async function assignTenant(
  id: string,
  propertyId: string,
): Promise<AssignTenantOutcome> {
  try {
    const tenant = await api.tenants.assign(id, { propertyId });
    return { success: true, tenant };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to assign tenant",
    };
  }
}

// Every tenant the landlord owns, unassigned first (the API sorts), for the
// tenants list popup.
export async function listLandlordTenants(): Promise<TenantListItem[]> {
  return api.tenants.list();
}

// Legacy-shaped tenant dashboard data. The API returns the normalized
// TenantDashboard DTO (lease/property split out, camelCase, statuses as lookup
// codes); this adapter flattens it back to the shape the tenant dashboard page
// already renders so that large page stays unchanged.
export interface TenantDashboardData {
  tenant: {
    id: string;
    tenant_name: string;
    email: string;
    contact_number: string;
    contract_months: number;
    rent_start_date: string;
    due_day: string;
  };
  property: {
    id: string;
    unit_name: string;
    property_type: string;
    property_location: string;
    rent_amount: number;
  };
  billingEntries: {
    id: string;
    period_id?: string;
    due_date: string;
    rent_due: number;
    other_charges: number;
    gross_due: number;
    status: string;
    billing_period: number;
    updated_at: string | null;
  }[];
  landlordName: string | null;
  payoutMethods: PayoutChannel[];
}

// Returns null when the tenant has no active lease/property to show (e.g. an
// unhoused tenant) — the page treats null as "nothing to display".
export async function fetchTenantDashboard(): Promise<TenantDashboardData | null> {
  const dto = await api.tenant.dashboard();
  if (!dto.property || !dto.lease) return null;

  return {
    tenant: {
      id: dto.tenant.id,
      tenant_name: dto.tenant.tenantName,
      email: dto.tenant.email ?? "",
      contact_number: dto.tenant.contactNumber,
      contract_months: dto.lease.contractPeriods ?? 0,
      rent_start_date: dto.lease.rentStartDate ?? "",
      due_day: dto.lease.dueDay != null ? String(dto.lease.dueDay) : "",
    },
    property: {
      id: dto.property.id,
      unit_name: dto.property.unitName,
      property_type: dto.property.propertyType ?? "",
      property_location: dto.property.propertyLocation ?? "",
      rent_amount: dto.property.rentAmount,
    },
    // The page's paid/pending logic predates lookup-code statuses; collapse the
    // codes back to that two-state view ("Paid" → paid, everything else pending).
    billingEntries: dto.billingEntries.map((e) => ({
      id: e.id,
      period_id: e.periodId ?? undefined,
      due_date: e.dueDate ?? "",
      rent_due: e.rentDue,
      other_charges: e.otherCharges,
      gross_due: e.grossDue,
      status: e.status === "Paid" ? "paid" : "pending",
      billing_period: e.sequence ?? 0,
      updated_at: e.updatedAt,
    })),
    landlordName: dto.landlordName,
    payoutMethods: dto.payoutMethods,
  };
}
