import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { billingStatusOf } from "./billing-status";

describe("billingStatusOf", () => {
  // Pin "today" so the Overdue / Not Yet Due boundary is deterministic.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15)); // 2026-06-15, local midnight
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is 'Not Yet Set' when nothing is billed yet", () => {
    expect(billingStatusOf(0, 0, 0, "2026-06-20")).toBe("Not Yet Set");
  });

  it("is 'Paid' once the balance is cleared", () => {
    expect(billingStatusOf(5000, 5000, 0, "2026-06-20")).toBe("Paid");
  });

  it("is 'Paid' when lease credit clears the balance despite less cash paid", () => {
    // Balance is 0 even though cash-plus-credit equals gross rather than exceeding it —
    // the regression case the applied-credit fix was about.
    expect(billingStatusOf(6500, 6500, 0, "2026-06-01")).toBe("Paid");
  });

  it("treats sub-cent dust as fully paid via the epsilon guard", () => {
    expect(billingStatusOf(5000, 4999.995, 0.005, "2026-06-20")).toBe("Paid");
  });

  it("is 'Partial' when some is paid but a balance remains", () => {
    expect(billingStatusOf(5000, 2000, 3000, "2026-06-20")).toBe("Partial");
  });

  it("is 'Overdue' when unpaid and past the due date", () => {
    expect(billingStatusOf(5000, 0, 5000, "2026-06-14")).toBe("Overdue");
  });

  it("is 'Not Yet Due' when unpaid and the due date is today or later", () => {
    expect(billingStatusOf(5000, 0, 5000, "2026-06-15")).toBe("Not Yet Due"); // due today
    expect(billingStatusOf(5000, 0, 5000, "2026-06-20")).toBe("Not Yet Due"); // future
  });

  it("ranks Paid and Partial above Overdue, matching the SQL ladder order", () => {
    // A past-due invoice that is fully or partially paid is never labelled Overdue.
    expect(billingStatusOf(5000, 5000, 0, "2026-06-01")).toBe("Paid");
    expect(billingStatusOf(5000, 2000, 3000, "2026-06-01")).toBe("Partial");
  });
});
