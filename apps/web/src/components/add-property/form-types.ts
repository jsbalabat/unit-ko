// Shared shapes for the add-property wizard. Lifted out of the form component so
// the pure logic (validation, schedule math) can be imported and tested without
// pulling in React.

export interface TenantInfo {
  tenantName: string;
  tenantEmail: string;
  contactNumber: string;
}

export type FormBasis =
  | "weekly"
  | "bi-weekly"
  | "monthly"
  | "quarterly"
  | "semi-annually"
  | "annually"
  | "";

export interface BillingPeriodDraft {
  dueDate: string;
  rentDue: number;
  otherCharges: number;
  grossDue: number;
  status: string;
  expenseItems: Array<{ id: string; name: string; amount: number }>;
}

/**
 * Whether the landlord is setting up tenants in this flow. Chosen explicitly on
 * step 1 rather than inferred from whether tenant fields have been typed into —
 * inference made the wizard's step count change mid-keystroke. "" = not chosen.
 */
export type PropertyIntent = "" | "tenants" | "vacant";

export interface PropertyFormData {
  intent: PropertyIntent;

  unitName: string;
  propertyType: string;

  // Legacy single-tenant fields, used when maxTenants <= 1.
  tenantName: string;
  tenantEmail: string;
  contactNumber: string;

  // pax mirrors maxTenants; kept for backward compatibility.
  pax: number;
  maxTenants: number;
  tenants: TenantInfo[];

  propertyLocation: string;
  billingType: "pre-organized" | "blank" | "";
  contractMonths: number;
  rentStartDate: string;
  dueDay: string;
  rentAmount: number;

  formBasis: FormBasis;
  collectionDay: string;
  collectionDates: number[];
  rentPerCollection: number;

  advancePayment: number;
  securityDeposit: number;
  leaseDate: string;

  billingSchedule: BillingPeriodDraft[];
}

export interface ValidationErrors {
  unitName?: string;
  propertyType?: string;
  maxTenants?: string;
  tenantName?: string;
  tenantEmail?: string;
  contactNumber?: string;
  pax?: string;
  propertyLocation?: string;
  billingType?: string;
  contractMonths?: string;
  rentStartDate?: string;
  rentAmount?: string;
  formBasis?: string;
  collectionDay?: string;
  collectionDates?: string;
  // Dynamic per-tenant keys, e.g. tenant0_name.
  [key: string]: string | undefined;
}
