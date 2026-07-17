import { describe, expect, it } from "vitest";
import type { PropertyFormData, TenantInfo } from "./form-types";
import {
  billableTenantCount,
  hasStartedFillingTenants,
  isAddingTenants,
  isValid,
  validateStep1,
  validateStep2,
  validateTenants,
} from "./validation";

function tenant(overrides: Partial<TenantInfo> = {}): TenantInfo {
  return {
    tenantName: "Ana Cruz",
    tenantEmail: "ana@example.com",
    contactNumber: "09171234567",
    ...overrides,
  };
}

const blank: TenantInfo = { tenantName: "", tenantEmail: "", contactNumber: "" };

// A form that passes step 1 as a vacant property: no tenant data, real rent.
function form(overrides: Partial<PropertyFormData> = {}): PropertyFormData {
  return {
    unitName: "Unit A",
    propertyType: "apartment",
    tenantName: "",
    tenantEmail: "",
    contactNumber: "",
    pax: 0,
    maxTenants: 1,
    tenants: [],
    propertyLocation: "123 Real Street, Cebu City",
    billingType: "pre-organized",
    contractMonths: 12,
    rentStartDate: "2026-01-01",
    dueDay: "15",
    rentAmount: 10_000,
    formBasis: "monthly",
    collectionDay: "",
    collectionDates: [15],
    rentPerCollection: 10_000,
    advancePayment: 0,
    securityDeposit: 0,
    leaseDate: "",
    billingSchedule: [],
    ...overrides,
  };
}

describe("isAddingTenants", () => {
  it("is false on an untouched form, so the wizard starts on the vacant path", () => {
    expect(isAddingTenants(form())).toBe(false);
  });

  it("follows the legacy field in single-tenant mode", () => {
    expect(isAddingTenants(form({ tenantName: "Juan" }))).toBe(true);
    expect(isAddingTenants(form({ tenantName: "   " }))).toBe(false);
  });

  it("follows the array in bed-space mode and ignores the legacy field", () => {
    expect(
      isAddingTenants(form({ maxTenants: 3, tenants: [blank], tenantName: "Juan" })),
    ).toBe(false);
    expect(isAddingTenants(form({ maxTenants: 3, tenants: [tenant()] }))).toBe(
      true,
    );
  });
});

describe("hasStartedFillingTenants", () => {
  // The two derivations disagree on purpose: an email with no name means the
  // user is mid-entry, so validation must complain rather than quietly treat the
  // property as vacant.
  it("is true for a half-filled tenant that isAddingTenants rejects", () => {
    const halfFilled = form({ tenantEmail: "juan@example.com" });

    expect(isAddingTenants(halfFilled)).toBe(false);
    expect(hasStartedFillingTenants(halfFilled)).toBe(true);
  });

  it("is false when every field is blank", () => {
    expect(hasStartedFillingTenants(form({ maxTenants: 2, tenants: [blank] }))).toBe(
      false,
    );
  });
});

describe("validateStep1", () => {
  it("accepts a vacant property with a real rent", () => {
    expect(isValid(validateStep1(form()))).toBe(true);
  });

  it.each([
    ["", "Unit name is required"],
    ["A", "Unit name must be at least 2 characters"],
  ])("rejects unit name %j", (unitName, message) => {
    expect(validateStep1(form({ unitName })).unitName).toBe(message);
  });

  it("requires a complete-looking address", () => {
    expect(validateStep1(form({ propertyLocation: "Cebu" })).propertyLocation).toBe(
      "Please provide a complete address (minimum 10 characters)",
    );
  });

  it.each([0, 21])("rejects capacity %i", (maxTenants) => {
    expect(validateStep1(form({ maxTenants })).maxTenants).toBeDefined();
  });

  describe("vacant intent", () => {
    it("requires a property rent when no tenant data is entered", () => {
      expect(validateStep1(form({ rentAmount: 0 })).rentAmount).toBe(
        "Rent amount must be greater than 0",
      );
    });

    it("does not ask for a property rent once tenant data exists", () => {
      const errors = validateStep1(
        form({
          rentAmount: 0,
          tenantName: "Juan",
          tenantEmail: "juan@example.com",
          contactNumber: "09171234567",
        }),
      );

      expect(errors.rentAmount).toBeUndefined();
    });
  });

  describe("single-tenant details", () => {
    it("demands the whole set once any field is touched", () => {
      const errors = validateStep1(form({ tenantEmail: "juan@example.com" }));

      expect(errors.tenantName).toBe(
        "Tenant name is required when filling tenant details",
      );
      expect(errors.contactNumber).toBe(
        "Contact number is required when filling tenant details",
      );
    });

    it("rejects a malformed email", () => {
      expect(
        validateStep1(form({ tenantName: "Juan", tenantEmail: "juan@" })).tenantEmail,
      ).toBe("Please enter a valid email address");
    });

    it.each(["09171234567", "+639171234567", "0917 123 4567", "0917-123-4567"])(
      "accepts PH mobile %s",
      (contactNumber) => {
        const errors = validateStep1(
          form({
            tenantName: "Juan",
            tenantEmail: "juan@example.com",
            contactNumber,
          }),
        );

        expect(errors.contactNumber).toBeUndefined();
      },
    );

    it.each(["12345", "08171234567", "0917123456789"])(
      "rejects non-PH mobile %s",
      (contactNumber) => {
        const errors = validateStep1(
          form({
            tenantName: "Juan",
            tenantEmail: "juan@example.com",
            contactNumber,
          }),
        );

        expect(errors.contactNumber).toBeDefined();
      },
    );

    it("skips single-tenant checks in bed-space mode", () => {
      const errors = validateStep1(
        form({ maxTenants: 3, tenants: [tenant()], tenantName: "" }),
      );

      expect(errors.tenantName).toBeUndefined();
    });
  });
});

describe("validateStep2", () => {
  it("stops at the template and checks nothing else", () => {
    const errors = validateStep2(
      form({ billingType: "", rentStartDate: "", rentPerCollection: 0 }),
    );

    expect(errors).toEqual({ billingType: "Billing template is required" });
  });

  it("only needs a start date for blank billing", () => {
    expect(isValid(validateStep2(form({ billingType: "blank" })))).toBe(true);
    expect(
      validateStep2(form({ billingType: "blank", rentStartDate: "" }))
        .rentStartDate,
    ).toBe("Rent start date is required");
  });

  it("accepts a well-formed pre-organized setup", () => {
    expect(isValid(validateStep2(form()))).toBe(true);
  });

  it.each([0, 101])("rejects contract duration %i", (contractPeriods) => {
    expect(
      validateStep2(form({ contractMonths: contractPeriods })).contractMonths,
    ).toBeDefined();
  });

  it("rejects a per-tenant rent below the floor", () => {
    expect(validateStep2(form({ rentPerCollection: 100 })).rentAmount).toBe(
      "Per-tenant rent seems too low (minimum ₱500)",
    );
  });

  // Each slot is under the per-tenant cap, but the property total isn't.
  it("catches a total that breaches the cap across bed-space slots", () => {
    const errors = validateStep2(
      form({ maxTenants: 5, tenants: [], rentPerCollection: 300_000 }),
    );

    expect(errors.rentAmount).toContain("exceeds maximum");
  });

  it("requires a collection day for weekly billing", () => {
    expect(
      validateStep2(form({ formBasis: "weekly", collectionDay: "" }))
        .collectionDay,
    ).toBe("Collection day is required for weekly billing");
  });

  it("requires both dates for bi-weekly billing", () => {
    expect(
      validateStep2(form({ formBasis: "bi-weekly", collectionDates: [1] }))
        .collectionDates,
    ).toBe("Both collection dates are required for bi-weekly");
  });

  it("requires a date for monthly billing", () => {
    expect(
      validateStep2(form({ formBasis: "monthly", collectionDates: [] }))
        .collectionDates,
    ).toBe("Collection date is required for monthly billing");
  });
});

describe("billableTenantCount", () => {
  it("bills every declared slot while a bed space is still unfilled", () => {
    expect(billableTenantCount(form({ maxTenants: 4, tenants: [] }))).toBe(4);
  });

  it("bills only the named occupants once any are entered", () => {
    expect(
      billableTenantCount(form({ maxTenants: 4, tenants: [tenant(), blank] })),
    ).toBe(1);
  });

  it("is always 1 in single-tenant mode", () => {
    expect(billableTenantCount(form({ maxTenants: 1 }))).toBe(1);
  });
});

describe("validateTenants", () => {
  it("flags the first slot when no slot has been touched", () => {
    const errors = validateTenants(form({ maxTenants: 2, tenants: [blank, blank] }));

    expect(errors.tenant0_name).toBe("Tenant 1 name is required");
    expect(errors.tenant1_name).toBeUndefined();
  });

  it("leaves untouched slots alone once another is filled", () => {
    const errors = validateTenants(
      form({ maxTenants: 2, tenants: [tenant(), blank] }),
    );

    expect(isValid(errors)).toBe(true);
  });

  it("demands the full set for a partly-filled slot, keyed by index", () => {
    const errors = validateTenants(
      form({
        maxTenants: 2,
        tenants: [tenant(), tenant({ tenantName: "", tenantEmail: "" })],
      }),
    );

    expect(errors.tenant1_name).toBe("Tenant 2 name is required");
    expect(errors.tenant1_email).toBe("Tenant 2 email is required");
    expect(errors.tenant0_name).toBeUndefined();
  });

  it("validates the shape of a filled slot's contact details", () => {
    const errors = validateTenants(
      form({
        maxTenants: 1,
        tenants: [tenant({ tenantEmail: "nope", contactNumber: "12345" })],
      }),
    );

    expect(errors.tenant0_email).toBe("Please enter a valid email for tenant 1");
    expect(errors.tenant0_contact).toBe(
      "Invalid Philippine mobile number for tenant 1",
    );
  });

  it("passes an empty slot list", () => {
    expect(isValid(validateTenants(form({ tenants: [] })))).toBe(true);
  });
});
