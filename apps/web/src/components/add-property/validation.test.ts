import { describe, expect, it } from "vitest";
import type { PropertyFormData, TenantInfo } from "./form-types";
import {
  billableTenantCount,
  hasStartedFillingTenants,
  isAddingTenants,
  isPristine,
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
    intent: "vacant",
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
  it("is false until an intent is chosen, so the wizard shows no branch yet", () => {
    expect(isAddingTenants(form({ intent: "" }))).toBe(false);
  });

  it("follows the explicit intent", () => {
    expect(isAddingTenants(form({ intent: "tenants" }))).toBe(true);
    expect(isAddingTenants(form({ intent: "vacant" }))).toBe(false);
  });

  // This is the whole point of the intent field: typing a name used to flip the
  // branch — and with it totalSteps — mid-keystroke.
  it("ignores typed-in tenant data entirely", () => {
    expect(isAddingTenants(form({ intent: "vacant", tenantName: "Juan" }))).toBe(
      false,
    );
    expect(
      isAddingTenants(
        form({ intent: "vacant", maxTenants: 3, tenants: [tenant()] }),
      ),
    ).toBe(false);
    expect(
      isAddingTenants(form({ intent: "tenants", tenantName: "", tenants: [] })),
    ).toBe(true);
  });
});

describe("isPristine", () => {
  // form() is deliberately a *filled* form, so build the empty one explicitly
  // rather than relying on overrides to blank every field.
  const empty = form({
    intent: "",
    unitName: "",
    propertyType: "",
    propertyLocation: "",
    maxTenants: 0,
    billingType: "",
    contractMonths: 0,
    rentStartDate: "",
    dueDay: "",
    rentAmount: 0,
    formBasis: "",
    collectionDates: [],
    rentPerCollection: 0,
  });

  it("is true for an untouched form", () => {
    expect(isPristine(empty)).toBe(true);
  });

  it("ignores fields the wizard seeds rather than the landlord typing them", () => {
    // Picking a frequency auto-fills these; on their own they are not input.
    expect(
      isPristine({ ...empty, collectionDates: [1, 16], collectionDay: "monday" }),
    ).toBe(true);
    expect(isPristine({ ...empty, pax: 0, dueDay: "15" })).toBe(true);
  });

  it("is false once any real field carries a value", () => {
    expect(isPristine({ ...empty, intent: "vacant" })).toBe(false);
    expect(isPristine({ ...empty, unitName: "Unit A" })).toBe(false);
    expect(isPristine({ ...empty, propertyLocation: "Cebu" })).toBe(false);
    expect(isPristine({ ...empty, maxTenants: 2 })).toBe(false);
    expect(isPristine({ ...empty, rentAmount: 1 })).toBe(false);
    expect(isPristine({ ...empty, advancePayment: 1 })).toBe(false);
    expect(isPristine({ ...empty, securityDeposit: 1 })).toBe(false);
    expect(isPristine({ ...empty, leaseDate: "2026-01-01" })).toBe(false);
    expect(isPristine({ ...empty, billingType: "blank" })).toBe(false);
  });

  it("treats whitespace as untouched", () => {
    expect(isPristine({ ...empty, unitName: "   " })).toBe(true);
  });

  it("catches a half-filled tenant, so a typo'd email still prompts", () => {
    expect(isPristine({ ...empty, tenantEmail: "ana@example.com" })).toBe(false);
  });

  // Capacity resets to 0 clear the fields the landlord can see, but leftover
  // entries in tenants[] are still input they'd lose. Checked unconditionally
  // so this doesn't rely on setMaxTenants having pruned the array.
  it("catches tenant input the current mode has stopped showing", () => {
    expect(
      isPristine({
        ...empty,
        maxTenants: 0,
        tenants: [tenant({ tenantName: "", contactNumber: "" })],
      }),
    ).toBe(false);
  });

  it("is false once a schedule has been generated", () => {
    expect(
      isPristine({
        ...empty,
        billingSchedule: [
          {
            dueDate: "2026-01-15",
            rentDue: 5000,
            otherCharges: 0,
            grossDue: 5000,
            status: "Not Yet Due",
            expenseItems: [],
          },
        ],
      }),
    ).toBe(false);
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

  describe("intent", () => {
    it("blocks until the branch is chosen", () => {
      expect(validateStep1(form({ intent: "" })).intent).toBe(
        "Choose whether this property has tenants yet",
      );
    });

    // Previously this fell through to the vacant path silently; with the choice
    // explicit it's a contradiction, so say so instead of quietly reinterpreting.
    it("rejects the tenants path with nothing filled in", () => {
      const errors = validateStep1(
        form({ intent: "tenants", tenantName: "", tenants: [] }),
      );

      expect(errors.tenantName).toBe(
        'Add at least one tenant, or switch to "Leave vacant for now"',
      );
    });
  });

  describe("vacant intent", () => {
    it("requires a property rent when no tenant data is entered", () => {
      expect(validateStep1(form({ rentAmount: 0 })).rentAmount).toBe(
        "Rent amount must be greater than 0",
      );
    });

    it("does not ask for a property rent on the tenants path", () => {
      const errors = validateStep1(
        form({
          intent: "tenants",
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
    // Every case here exercises the tenants path, which is now reached by
    // choosing it — not by having typed something into a tenant field. Without
    // the explicit intent these checks don't run at all, and the assertions
    // that expect *no* error would pass for the wrong reason.
    const tenantForm = (overrides: Partial<PropertyFormData> = {}) =>
      form({ intent: "tenants", ...overrides });

    it("demands the whole set once any field is touched", () => {
      const errors = validateStep1(
        tenantForm({ tenantEmail: "juan@example.com" }),
      );

      expect(errors.tenantName).toBe(
        "Tenant name is required when filling tenant details",
      );
      expect(errors.contactNumber).toBe(
        "Contact number is required when filling tenant details",
      );
    });

    it("rejects a malformed email", () => {
      expect(
        validateStep1(tenantForm({ tenantName: "Juan", tenantEmail: "juan@" }))
          .tenantEmail,
      ).toBe("Please enter a valid email address");
    });

    it.each(["09171234567", "+639171234567", "0917 123 4567", "0917-123-4567"])(
      "accepts PH mobile %s",
      (contactNumber) => {
        const errors = validateStep1(
          tenantForm({
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
          tenantForm({
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
        tenantForm({ maxTenants: 3, tenants: [tenant()], tenantName: "" }),
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
