import { describe, expect, it } from "vitest";
import { toCreatePropertyInput } from "@/services/propertyService";

// The form's state shape is internal to the service; derive it from the function
// under test so the fixture can't drift from the real contract.
type FormData = Parameters<typeof toCreatePropertyInput>[0];

function form(overrides: Partial<FormData> = {}): FormData {
  return {
    unitName: "Unit A",
    propertyType: "apartment",
    propertyLocation: "Cebu City",
    rentAmount: 10_000,
    pax: 0,
    maxTenants: 1,
    tenants: [],
    tenantName: "",
    tenantEmail: "",
    contactNumber: "",
    formBasis: "monthly",
    contractMonths: 12,
    rentStartDate: "2026-01-01",
    dueDay: "15",
    rentPerCollection: 10_000,
    advancePayment: 0,
    securityDeposit: 0,
    leaseDate: "",
    billingSchedule: [],
    ...overrides,
  };
}

describe("toCreatePropertyInput", () => {
  describe("occupants", () => {
    // The regression this pins: bed-space mode with unfilled slots used to drop a
    // tenant typed into the legacy single-tenant fields.
    it("keeps the legacy tenant when every bed-space slot is blank", () => {
      const input = toCreatePropertyInput(
        form({
          maxTenants: 3,
          tenants: [
            { tenantName: "", tenantEmail: "", contactNumber: "" },
            { tenantName: "   ", tenantEmail: "", contactNumber: "" },
          ],
          tenantName: "Juan Dela Cruz",
          tenantEmail: "juan@example.com",
          contactNumber: "09171234567",
        }),
      );

      expect(input.tenants).toEqual([
        {
          tenantName: "Juan Dela Cruz",
          email: "juan@example.com",
          contactNumber: "09171234567",
        },
      ]);
    });

    it("prefers named bed-space occupants over the legacy fields", () => {
      const input = toCreatePropertyInput(
        form({
          maxTenants: 2,
          tenants: [
            {
              tenantName: "Ana Cruz",
              tenantEmail: "ana@example.com",
              contactNumber: "09170000001",
            },
          ],
          tenantName: "Ignored Legacy",
          tenantEmail: "legacy@example.com",
          contactNumber: "09179999999",
        }),
      );

      expect(input.tenants).toEqual([
        {
          tenantName: "Ana Cruz",
          email: "ana@example.com",
          contactNumber: "09170000001",
        },
      ]);
    });

    it("drops unnamed bed-space slots but keeps the named ones", () => {
      const input = toCreatePropertyInput(
        form({
          maxTenants: 3,
          tenants: [
            {
              tenantName: "Ana",
              tenantEmail: "ana@example.com",
              contactNumber: "1",
            },
            { tenantName: "", tenantEmail: "ghost@example.com", contactNumber: "2" },
            { tenantName: "Luis", tenantEmail: "luis@example.com", contactNumber: "3" },
          ],
        }),
      );

      expect(input.tenants.map((t) => t.tenantName)).toEqual(["Ana", "Luis"]);
    });

    it("trims names and normalises blank contact details", () => {
      const input = toCreatePropertyInput(
        form({
          tenantName: "  Juan  ",
          tenantEmail: "   ",
          contactNumber: "   ",
        }),
      );

      expect(input.tenants).toEqual([
        { tenantName: "Juan", email: null, contactNumber: "" },
      ]);
    });

    it("sends no tenants when nothing is named", () => {
      expect(toCreatePropertyInput(form()).tenants).toEqual([]);
    });
  });

  describe("dueDay", () => {
    it.each([
      ["1", 1],
      ["15", 15],
      ["31", 31],
    ])("accepts in-range day %s", (raw, expected) => {
      expect(toCreatePropertyInput(form({ dueDay: raw })).lease.dueDay).toBe(
        expected,
      );
    });

    it.each(["0", "32", "abc", ""])("rejects out-of-range or junk %j", (raw) => {
      expect(toCreatePropertyInput(form({ dueDay: raw })).lease.dueDay).toBeNull();
    });
  });

  describe("billingFrequency", () => {
    it("passes a known frequency through", () => {
      expect(
        toCreatePropertyInput(form({ formBasis: "quarterly" })).lease
          .billingFrequency,
      ).toBe("quarterly");
    });

    it("falls back to monthly when the form left it blank", () => {
      expect(
        toCreatePropertyInput(form({ formBasis: "" })).lease.billingFrequency,
      ).toBe("monthly");
    });
  });

  describe("billingSchedule", () => {
    const period = (overrides: Partial<FormData["billingSchedule"][number]>) => ({
      dueDate: "2026-02-01",
      rentDue: 5_000,
      otherCharges: 0,
      grossDue: 5_000,
      status: "Not Yet Due",
      expenseItems: [],
      ...overrides,
    });

    it("drops periods whose due date isn't ISO YYYY-MM-DD", () => {
      const input = toCreatePropertyInput(
        form({
          billingSchedule: [
            period({ dueDate: "2026-02-01" }),
            period({ dueDate: "02/01/2026" }),
            period({ dueDate: "" }),
          ],
        }),
      );

      expect(input.billingSchedule.map((b) => b.dueDate)).toEqual([
        "2026-02-01",
      ]);
    });

    it("keeps a known status and discards an unknown one", () => {
      const input = toCreatePropertyInput(
        form({
          billingSchedule: [
            period({ dueDate: "2026-02-01", status: "Overdue" }),
            period({ dueDate: "2026-03-01", status: "Good Standing" }),
          ],
        }),
      );

      expect(input.billingSchedule[0]?.status).toBe("Overdue");
      expect(input.billingSchedule[1]?.status).toBeUndefined();
    });

    it("keeps only named charges, so other_charges stays derivable", () => {
      const input = toCreatePropertyInput(
        form({
          billingSchedule: [
            period({
              expenseItems: [
                { id: "1", name: "Water", amount: 300 },
                { id: "2", name: "   ", amount: 999 },
              ],
            }),
          ],
        }),
      );

      expect(input.billingSchedule[0]?.charges).toEqual([
        { name: "Water", amount: 300 },
      ]);
    });
  });

  describe("maxTenants", () => {
    it("prefers maxTenants, then pax, then 1", () => {
      expect(toCreatePropertyInput(form({ maxTenants: 4, pax: 2 })).maxTenants).toBe(4);
      expect(toCreatePropertyInput(form({ maxTenants: 0, pax: 2 })).maxTenants).toBe(2);
      expect(toCreatePropertyInput(form({ maxTenants: 0, pax: 0 })).maxTenants).toBe(1);
    });
  });
});
