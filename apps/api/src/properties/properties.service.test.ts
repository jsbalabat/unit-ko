import { describe, expect, it } from "vitest";
import { toLeaseTerms } from "./properties.service";

describe("toLeaseTerms", () => {
  it("maps a lease row to DTO terms, narrowing the billing frequency", () => {
    expect(
      toLeaseTerms({
        billing_frequency_code: "monthly",
        contract_periods: 6,
        rent_start_date: "2026-06-01",
        rent_end_date: "2026-12-01",
        due_day: 5,
        rent_amount: 1000,
        advance_payment: 1000,
        security_deposit: 2000,
      }),
    ).toEqual({
      billingFrequency: "monthly",
      contractPeriods: 6,
      rentStartDate: "2026-06-01",
      rentEndDate: "2026-12-01",
      dueDay: 5,
      rentAmount: 1000,
      advancePayment: 1000,
      securityDeposit: 2000,
    });
  });

  it("returns null when there is no active lease", () => {
    expect(toLeaseTerms(null)).toBeNull();
  });

  it("falls back to 'monthly' for an unknown frequency and 0 for null amounts", () => {
    expect(
      toLeaseTerms({
        billing_frequency_code: "fortnightly",
        contract_periods: null,
        rent_start_date: null,
        rent_end_date: null,
        due_day: null,
        rent_amount: null,
        advance_payment: null,
        security_deposit: null,
      }),
    ).toEqual({
      billingFrequency: "monthly",
      contractPeriods: null,
      rentStartDate: null,
      rentEndDate: null,
      dueDay: null,
      rentAmount: 0,
      advancePayment: 0,
      securityDeposit: 0,
    });
  });
});
