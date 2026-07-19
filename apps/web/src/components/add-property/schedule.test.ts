import { describe, expect, it } from "vitest";
import type { PropertyFormData } from "./form-types";
import { buildBillingSchedule, scheduleInputsKey } from "./schedule";

// Fixed so Overdue/Not Yet Due never depends on when the suite runs.
const TODAY = new Date(2026, 0, 15);

function form(overrides: Partial<PropertyFormData> = {}): PropertyFormData {
  return {
    intent: "tenants",
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
    contractMonths: 3,
    rentStartDate: "2026-01-01",
    dueDay: "15",
    rentAmount: 5_000,
    formBasis: "monthly",
    collectionDay: "",
    collectionDates: [15],
    rentPerCollection: 5_000,
    advancePayment: 0,
    securityDeposit: 0,
    leaseDate: "",
    billingSchedule: [],
    ...overrides,
  };
}

function periodsOf(result: ReturnType<typeof buildBillingSchedule>) {
  if (!result.ok) throw new Error(`expected a schedule, got: ${result.reason}`);
  return result.periods;
}

describe("buildBillingSchedule", () => {
  describe("rent is per tenant, never the property total", () => {
    // The regression this pins: create_property_atomic writes rentDue into one
    // invoice per lease, and there's a lease per tenant. Billing the total here
    // charged every tenant the whole property's rent.
    it("bills each period the per-tenant rent in a bed space", () => {
      const periods = periodsOf(
        buildBillingSchedule(
          form({
            maxTenants: 3,
            tenants: [
              { tenantName: "Ana", tenantEmail: "a@x.com", contactNumber: "1" },
              { tenantName: "Luis", tenantEmail: "l@x.com", contactNumber: "2" },
              { tenantName: "Rosa", tenantEmail: "r@x.com", contactNumber: "3" },
            ],
            rentPerCollection: 5_000,
          }),
          TODAY,
        ),
      );

      expect(periods.every((p) => p.rentDue === 5_000)).toBe(true);
      expect(periods.every((p) => p.grossDue === 5_000)).toBe(true);
    });

    it("falls back to the property rent when there's no per-collection rent", () => {
      const periods = periodsOf(
        buildBillingSchedule(
          form({ rentPerCollection: 0, rentAmount: 7_500 }),
          TODAY,
        ),
      );

      expect(periods[0]?.rentDue).toBe(7_500);
    });
  });

  describe("guards", () => {
    it("refuses without a start date", () => {
      const result = buildBillingSchedule(form({ rentStartDate: "" }), TODAY);

      expect(result).toEqual({
        ok: false,
        reason: "Please select a rent start date first",
      });
    });

    it("refuses without any rent", () => {
      const result = buildBillingSchedule(
        form({ rentPerCollection: 0, rentAmount: 0 }),
        TODAY,
      );

      expect(result.ok).toBe(false);
    });

    it("refuses an unset frequency", () => {
      expect(buildBillingSchedule(form({ formBasis: "" }), TODAY).ok).toBe(false);
    });

    it("refuses bi-weekly without exactly two dates", () => {
      expect(
        buildBillingSchedule(
          form({ formBasis: "bi-weekly", collectionDates: [1] }),
          TODAY,
        ).ok,
      ).toBe(false);
    });

    it("refuses monthly without a date", () => {
      expect(
        buildBillingSchedule(form({ formBasis: "monthly", collectionDates: [] }), TODAY)
          .ok,
      ).toBe(false);
    });
  });

  describe("monthly", () => {
    it("emits exactly contractMonths periods on the collection day", () => {
      const periods = periodsOf(
        buildBillingSchedule(
          form({ contractMonths: 3, collectionDates: [15] }),
          TODAY,
        ),
      );

      expect(periods.map((p) => p.dueDate)).toEqual([
        "2026-01-15",
        "2026-02-15",
        "2026-03-15",
      ]);
    });

    // The collection day already passed in the start month, so month one is skipped.
    it("starts next month when the collection day is on or before the start", () => {
      const periods = periodsOf(
        buildBillingSchedule(
          form({ rentStartDate: "2026-01-20", contractMonths: 2, collectionDates: [15] }),
          TODAY,
        ),
      );

      expect(periods.map((p) => p.dueDate)).toEqual(["2026-02-15", "2026-03-15"]);
    });

    it("clamps to the last day of a short month instead of rolling over", () => {
      const periods = periodsOf(
        buildBillingSchedule(
          form({ rentStartDate: "2026-01-01", contractMonths: 3, collectionDates: [31] }),
          TODAY,
        ),
      );

      // February 2026 has 28 days — the 31st must not become March 3rd.
      expect(periods.map((p) => p.dueDate)).toEqual([
        "2026-01-31",
        "2026-02-28",
        "2026-03-31",
      ]);
    });
  });

  describe("weekly", () => {
    it("emits weekly periods on the chosen weekday", () => {
      const periods = periodsOf(
        buildBillingSchedule(
          form({
            formBasis: "weekly",
            collectionDay: "monday",
            rentStartDate: "2026-01-01",
            contractMonths: 3,
          }),
          TODAY,
        ),
      );

      // 2026-01-01 is a Thursday; the next Monday is the 5th.
      expect(periods.map((p) => p.dueDate)).toEqual([
        "2026-01-05",
        "2026-01-12",
        "2026-01-19",
      ]);
    });
  });

  describe("bi-weekly", () => {
    it("emits both collection dates each month until the count is met", () => {
      const periods = periodsOf(
        buildBillingSchedule(
          form({
            formBasis: "bi-weekly",
            collectionDates: [16, 1],
            rentStartDate: "2026-01-01",
            contractMonths: 4,
          }),
          TODAY,
        ),
      );

      // Dates are sorted, and Jan 1 is not after the start so it's skipped.
      expect(periods.map((p) => p.dueDate)).toEqual([
        "2026-01-16",
        "2026-02-01",
        "2026-02-16",
        "2026-03-01",
      ]);
    });

    it("does not mutate the caller's collectionDates while sorting", () => {
      const collectionDates = [16, 1];
      buildBillingSchedule(
        form({ formBasis: "bi-weekly", collectionDates, contractMonths: 2 }),
        TODAY,
      );

      expect(collectionDates).toEqual([16, 1]);
    });
  });

  describe("longer strides", () => {
    it.each([
      ["quarterly" as const, ["2026-04-01", "2026-07-01"]],
      ["semi-annually" as const, ["2026-07-01", "2027-01-01"]],
      ["annually" as const, ["2027-01-01", "2028-01-01"]],
    ])("steps %s from one period after the start", (formBasis, expected) => {
      const periods = periodsOf(
        buildBillingSchedule(
          form({ formBasis, rentStartDate: "2026-01-01", contractMonths: 2 }),
          TODAY,
        ),
      );

      expect(periods.map((p) => p.dueDate)).toEqual(expected);
    });
  });

  describe("scheduleInputsKey", () => {
    it("is stable for the same inputs", () => {
      expect(scheduleInputsKey(form())).toBe(scheduleInputsKey(form()));
    });

    // Regenerating destroys per-period edits, so anything the builder reads must
    // move the key — and anything it ignores must not.
    it.each([
      ["formBasis", { formBasis: "weekly" as const }],
      ["contractMonths", { contractMonths: 6 }],
      ["rentStartDate", { rentStartDate: "2026-03-01" }],
      ["rentPerCollection", { rentPerCollection: 9_999 }],
      ["rentAmount", { rentAmount: 9_999 }],
      ["collectionDates", { collectionDates: [1, 16] }],
      ["collectionDay", { collectionDay: "friday" }],
    ])("changes when %s changes", (_field, overrides) => {
      expect(scheduleInputsKey(form(overrides))).not.toBe(
        scheduleInputsKey(form()),
      );
    });

    it.each([
      ["unitName", { unitName: "Renamed" }],
      ["propertyLocation", { propertyLocation: "456 Other Street, Manila" }],
      ["maxTenants", { maxTenants: 4 }],
      ["advancePayment", { advancePayment: 1_000 }],
    ])("ignores %s, which the builder never reads", (_field, overrides) => {
      expect(scheduleInputsKey(form(overrides))).toBe(scheduleInputsKey(form()));
    });
  });

  describe("status", () => {
    it("marks periods before today Overdue and the rest Not Yet Due", () => {
      const periods = periodsOf(
        buildBillingSchedule(
          form({ rentStartDate: "2025-11-01", contractMonths: 4, collectionDates: [15] }),
          TODAY,
        ),
      );

      // TODAY is 2026-01-15; the 15th itself is not before midnight today.
      expect(periods.map((p) => [p.dueDate, p.status])).toEqual([
        ["2025-11-15", "Overdue"],
        ["2025-12-15", "Overdue"],
        ["2026-01-15", "Not Yet Due"],
        ["2026-02-15", "Not Yet Due"],
      ]);
    });
  });
});
