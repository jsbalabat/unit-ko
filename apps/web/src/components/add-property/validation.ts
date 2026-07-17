import type { PropertyFormData, ValidationErrors } from "./form-types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// PH mobile: optional +63/0 prefix, then 9XXXXXXXXX.
const PH_MOBILE = /^(\+63|0)?9\d{9}$/;

const digits = (value: string) => value.replace(/\s|-/g, "");

/**
 * Whether the landlord is entering tenants — the wizard's branch condition.
 * Keyed on a *name* specifically: a name is what actually becomes a tenant.
 *
 * Not the same as the property's occupancy, which the server derives from an
 * active lease (v_property_occupancy) and which no form field can set.
 */
export function isAddingTenants(formData: PropertyFormData): boolean {
  return formData.maxTenants > 1
    ? formData.tenants.some((t) => t.tenantName?.trim())
    : Boolean(formData.tenantName?.trim());
}

/**
 * Whether *any* tenant field has been touched — deliberately broader than
 * {@link isAddingTenants}, which needs a name. Validation uses this so a
 * half-filled tenant (email only, no name) is an error rather than being
 * silently treated as a vacant property.
 */
export function hasStartedFillingTenants(formData: PropertyFormData): boolean {
  return formData.maxTenants > 1
    ? formData.tenants.some(
        (t) =>
          t.tenantName?.trim() || t.tenantEmail?.trim() || t.contactNumber?.trim(),
      )
    : Boolean(
        formData.tenantName?.trim() ||
          formData.tenantEmail?.trim() ||
          formData.contactNumber?.trim(),
      );
}

export function validateStep1(formData: PropertyFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!formData.unitName.trim()) {
    errors.unitName = "Unit name is required";
  } else if (formData.unitName.trim().length < 2) {
    errors.unitName = "Unit name must be at least 2 characters";
  }

  if (!formData.propertyType) {
    errors.propertyType = "Property type is required";
  }

  if (!formData.propertyLocation.trim()) {
    errors.propertyLocation = "Property location is required";
  } else if (formData.propertyLocation.trim().length < 10) {
    errors.propertyLocation =
      "Please provide a complete address (minimum 10 characters)";
  }

  // Capacity is record-keeping and required regardless of occupancy.
  if (
    !formData.maxTenants ||
    formData.maxTenants === 0 ||
    formData.maxTenants < 1
  ) {
    errors.maxTenants = "At least 1 tenant slot is required (1-20)";
  } else if (formData.maxTenants > 20) {
    errors.maxTenants = "Maximum 20 tenant slots allowed";
  }

  const startedTenants = hasStartedFillingTenants(formData);

  // Vacant intent — the per-tenant rent path won't run, so require a
  // property-level rent up front.
  if (!startedTenants) {
    if (!formData.rentAmount || formData.rentAmount <= 0) {
      errors.rentAmount = "Rent amount must be greater than 0";
    } else if (formData.rentAmount < 1000) {
      errors.rentAmount = "Rent amount seems too low (minimum ₱1,000)";
    } else if (formData.rentAmount > 1000000) {
      errors.rentAmount = "Rent amount seems too high (maximum ₱1,000,000)";
    }
  }

  if (startedTenants && formData.maxTenants === 1) {
    if (!formData.tenantName.trim()) {
      errors.tenantName = "Tenant name is required when filling tenant details";
    } else if (formData.tenantName.trim().length < 2) {
      errors.tenantName = "Tenant name must be at least 2 characters";
    }

    if (!formData.tenantEmail.trim()) {
      errors.tenantEmail = "Email is required when filling tenant details";
    } else if (!EMAIL.test(formData.tenantEmail)) {
      errors.tenantEmail = "Please enter a valid email address";
    }

    if (!formData.contactNumber.trim()) {
      errors.contactNumber =
        "Contact number is required when filling tenant details";
    } else if (!PH_MOBILE.test(digits(formData.contactNumber))) {
      errors.contactNumber =
        "Please enter a valid Philippine mobile number (e.g., 09123456789)";
    }
  }

  return errors;
}

export function validateStep2(formData: PropertyFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  // Without a template there's nothing else to check.
  if (!formData.billingType) {
    errors.billingType = "Billing template is required";
    return errors;
  }

  if (formData.billingType === "pre-organized") {
    if (!formData.contractMonths || formData.contractMonths === 0) {
      errors.contractMonths = "Contract duration is required";
    } else if (formData.contractMonths < 1) {
      errors.contractMonths = "Contract duration must be at least 1 period";
    } else if (formData.contractMonths > 100) {
      errors.contractMonths = "Contract duration cannot exceed 100 periods";
    }
  }

  if (!formData.rentStartDate) {
    errors.rentStartDate = "Rent start date is required";
  }

  // Blank billing only needs a start date.
  if (formData.billingType === "blank") {
    return errors;
  }

  if (!formData.formBasis) {
    errors.formBasis = "Billing frequency is required";
  }

  if (!formData.rentPerCollection || formData.rentPerCollection === 0) {
    errors.rentAmount = "Rent per tenant is required";
  } else if (formData.rentPerCollection < 0) {
    errors.rentAmount = "Rent per tenant must be greater than 0";
  } else if (formData.rentPerCollection < 500) {
    errors.rentAmount = "Per-tenant rent seems too low (minimum ₱500)";
  } else if (formData.rentPerCollection > 1000000) {
    errors.rentAmount = "Per-tenant rent seems too high (maximum ₱1,000,000)";
  }

  const totalRent = formData.rentPerCollection * billableTenantCount(formData);
  if (totalRent > 1000000) {
    errors.rentAmount = `Total property rent (₱${totalRent.toLocaleString()}) exceeds maximum of ₱1,000,000`;
  }

  if (formData.formBasis === "weekly" && !formData.collectionDay) {
    errors.collectionDay = "Collection day is required for weekly billing";
  }

  if (formData.formBasis === "bi-weekly") {
    if (!formData.collectionDates || formData.collectionDates.length === 0) {
      errors.collectionDates =
        "Collection dates are required for bi-weekly billing";
    } else if (!formData.collectionDates[0] || !formData.collectionDates[1]) {
      errors.collectionDates = "Both collection dates are required for bi-weekly";
    }
  }

  if (formData.formBasis === "monthly") {
    if (!formData.collectionDates || formData.collectionDates.length === 0) {
      errors.collectionDates = "Collection date is required for monthly billing";
    } else if (!formData.collectionDates[0]) {
      errors.collectionDates = "Collection date is required for monthly";
    }
  }

  return errors;
}

/**
 * Heads the rent maths: named occupants if any have been entered, otherwise the
 * declared capacity (an unfilled bed-space property still bills every slot).
 */
export function billableTenantCount(formData: PropertyFormData): number {
  const filled =
    formData.tenants?.filter((t) => t.tenantName && t.tenantName.trim() !== "")
      .length || 0;

  if (formData.maxTenants > 1) return filled > 0 ? filled : formData.maxTenants;
  return 1;
}

// Blank billing may legitimately have no periods, and pre-organized periods are
// generated rather than typed — so there is nothing to reject here. Kept as a
// named step so the wizard's flow reads uniformly.
export function validateBillingSchedule(): ValidationErrors {
  return {};
}

export function validateTenants(formData: PropertyFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  const hasAnyTenant = formData.tenants.some(
    (t) => t.tenantName || t.tenantEmail || t.contactNumber,
  );

  // Nothing entered at all — point the user at the first slot.
  if (!hasAnyTenant && formData.tenants.length > 0) {
    errors.tenant0_name = "Tenant 1 name is required";
    errors.tenant0_email = "Tenant 1 email is required";
    errors.tenant0_contact = "Tenant 1 contact is required";
    return errors;
  }

  // A slot with any field filled must have all of them; untouched slots stay
  // optional so a partly-occupied bed space is valid.
  formData.tenants.forEach((tenant, index) => {
    const touched =
      tenant.tenantName || tenant.tenantEmail || tenant.contactNumber;
    if (!touched) return;

    if (!tenant.tenantName.trim()) {
      errors[`tenant${index}_name`] = `Tenant ${index + 1} name is required`;
    } else if (tenant.tenantName.trim().length < 2) {
      errors[`tenant${index}_name`] =
        `Tenant ${index + 1} name must be at least 2 characters`;
    }

    if (!tenant.tenantEmail.trim()) {
      errors[`tenant${index}_email`] = `Tenant ${index + 1} email is required`;
    } else if (!EMAIL.test(tenant.tenantEmail)) {
      errors[`tenant${index}_email`] =
        `Please enter a valid email for tenant ${index + 1}`;
    }

    if (!tenant.contactNumber.trim()) {
      errors[`tenant${index}_contact`] =
        `Tenant ${index + 1} contact is required`;
    } else if (!PH_MOBILE.test(digits(tenant.contactNumber))) {
      errors[`tenant${index}_contact`] =
        `Invalid Philippine mobile number for tenant ${index + 1}`;
    }
  });

  return errors;
}

export function isValid(errors: ValidationErrors): boolean {
  return Object.keys(errors).length === 0;
}
