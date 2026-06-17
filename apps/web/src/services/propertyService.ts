import { api } from "@/lib/api-client";
import {
  BILLING_FREQUENCIES,
  BILLING_STATUSES,
  type BillingFrequency,
  type BillingStatus,
  type CreatePropertyInput,
  type PropertyDetail,
} from "@unitko/shared";

// Individual occupant as captured by the add-property form.
interface TenantInfo {
  tenantName: string;
  tenantEmail: string;
  contactNumber: string;
}

// The slice of the add-property form's state this service consumes. Kept here as
// the service's input contract; the form's full state is a structural superset.
interface PropertyFormData {
  unitName: string;
  propertyType: string;
  propertyLocation: string;
  rentAmount: number;
  pax: number;
  maxTenants: number;
  tenants: TenantInfo[];
  // Legacy single-tenant fields, used when maxTenants <= 1.
  tenantName: string;
  tenantEmail: string;
  contactNumber: string;
  formBasis: BillingFrequency | "";
  contractMonths: number;
  rentStartDate: string;
  dueDay: string;
  rentPerCollection: number;
  advancePayment: number;
  securityDeposit: number;
  leaseDate: string;
  billingSchedule: Array<{
    dueDate: string;
    rentDue: number;
    otherCharges: number;
    grossDue: number;
    status: string;
    expenseItems: Array<{ id: string; name: string; amount: number }>;
  }>;
}

interface PropertySubmissionResult {
  success: boolean;
  data?: PropertyDetail;
  error?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Translates the form's flat, legacy-shaped state into the normalized create
// contract: a property + shared lease terms + occupants + a billing schedule
// whose charges become billing_charges rows (so other_charges stays derived).
function toCreatePropertyInput(formData: PropertyFormData): CreatePropertyInput {
  const occupants =
    formData.maxTenants > 1 || formData.tenants.length > 0
      ? formData.tenants
      : [
          {
            tenantName: formData.tenantName,
            tenantEmail: formData.tenantEmail,
            contactNumber: formData.contactNumber,
          },
        ];

  const tenants = occupants
    .filter((t) => t.tenantName?.trim())
    .map((t) => ({
      tenantName: t.tenantName.trim(),
      email: t.tenantEmail?.trim() || null,
      contactNumber: t.contactNumber?.trim() || "",
    }));

  const dueDayNum = Number.parseInt(formData.dueDay, 10);
  const dueDay =
    Number.isInteger(dueDayNum) && dueDayNum >= 1 && dueDayNum <= 31
      ? dueDayNum
      : null;

  const billingFrequency: BillingFrequency = (
    BILLING_FREQUENCIES as readonly string[]
  ).includes(formData.formBasis)
    ? (formData.formBasis as BillingFrequency)
    : "monthly";

  // Only well-formed YYYY-MM-DD periods survive; the API requires a real date.
  const billingSchedule = formData.billingSchedule
    .filter((b) => ISO_DATE.test(b.dueDate))
    .map((b) => ({
      dueDate: b.dueDate,
      rentDue: b.rentDue ?? 0,
      status: (BILLING_STATUSES as readonly string[]).includes(b.status)
        ? (b.status as BillingStatus)
        : undefined,
      charges: (b.expenseItems ?? [])
        .filter((e) => e.name?.trim())
        .map((e) => ({ name: e.name.trim(), amount: e.amount ?? 0 })),
    }));

  return {
    unitName: formData.unitName,
    propertyType: formData.propertyType || null,
    propertyLocation: formData.propertyLocation || null,
    rentAmount: formData.rentAmount,
    maxTenants: formData.maxTenants || formData.pax || 1,
    billingMode: "unified",
    leaseDate: formData.leaseDate || null,
    amenities: [],
    lease: {
      billingFrequency,
      contractPeriods: formData.contractMonths > 0 ? formData.contractMonths : null,
      rentStartDate: formData.rentStartDate || null,
      dueDay,
      rentAmount:
        formData.rentPerCollection > 0 ? formData.rentPerCollection : undefined,
      advancePayment: formData.advancePayment || 0,
      securityDeposit: formData.securityDeposit || 0,
    },
    tenants,
    billingSchedule,
  };
}

// Create a property (with its tenants, lease, and billing schedule) atomically
// through the API. The API logs the creation activity server-side.
export async function submitPropertyData(
  formData: PropertyFormData,
): Promise<PropertySubmissionResult> {
  try {
    const property = await api.properties.create(toCreatePropertyInput(formData));
    return { success: true, data: property };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
