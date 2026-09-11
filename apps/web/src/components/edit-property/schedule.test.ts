import { describe, expect, it } from "vitest";
import {
  calculatePeriodDueDate,
  formatDueDate,
  inferBillingFrequency,
  isValidBiWeeklyDueDayPair,
  parseBiWeeklyDueDay,
} from "./types";

describe("edit-property schedule utilities", () => {
  describe("inferBillingFrequency", () => {
    it("defaults to monthly when fewer than 2 entries exist", () => {
      expect(inferBillingFrequency([])).toBe("monthly");
      expect(inferBillingFrequency([{ dueDate: "2026-01-01" }])).toBe("monthly");
    });

    it("detects weekly frequency (diff <= 8 days)", () => {
      const entries = [
        { dueDate: "2026-01-01" },
        { dueDate: "2026-01-08" },
      ];
      expect(inferBillingFrequency(entries)).toBe("weekly");
    });

    it("detects bi-weekly frequency (diff between 9 and 16 days)", () => {
      const entries = [
        { dueDate: "2026-01-01" },
        { dueDate: "2026-01-15" },
      ];
      expect(inferBillingFrequency(entries)).toBe("bi-weekly");
    });

    it("detects monthly frequency (diff between 17 and 45 days)", () => {
      const entries = [
        { dueDate: "2026-01-01" },
        { dueDate: "2026-02-01" },
      ];
      expect(inferBillingFrequency(entries)).toBe("monthly");
    });

    it("detects quarterly frequency (diff between 46 and 120 days)", () => {
      const entries = [
        { dueDate: "2026-01-01" },
        { dueDate: "2026-04-01" },
      ];
      expect(inferBillingFrequency(entries)).toBe("quarterly");
    });

    it("detects semi-annually frequency (diff between 121 and 220 days)", () => {
      const entries = [
        { dueDate: "2026-01-01" },
        { dueDate: "2026-07-01" },
      ];
      expect(inferBillingFrequency(entries)).toBe("semi-annually");
    });

    it("detects annually frequency (diff > 220 days)", () => {
      const entries = [
        { dueDate: "2026-01-01" },
        { dueDate: "2027-01-01" },
      ];
      expect(inferBillingFrequency(entries)).toBe("annually");
    });
  });

  describe("parseBiWeeklyDueDay & isValidBiWeeklyDueDayPair", () => {
    it("parses valid comma-separated day pairs", () => {
      expect(parseBiWeeklyDueDay("1,16")).toEqual({ firstDay: 1, secondDay: 16 });
      expect(parseBiWeeklyDueDay("5,20")).toEqual({ firstDay: 5, secondDay: 20 });
    });

    it("validates bi-weekly ranges (1-15 and 16-31)", () => {
      expect(isValidBiWeeklyDueDayPair("1,16")).toBe(true);
      expect(isValidBiWeeklyDueDayPair("15,31")).toBe(true);
      expect(isValidBiWeeklyDueDayPair("16,15")).toBe(false);
      expect(isValidBiWeeklyDueDayPair("0,20")).toBe(false);
      expect(isValidBiWeeklyDueDayPair("5,32")).toBe(false);
    });
  });

  describe("calculatePeriodDueDate", () => {
    it("calculates monthly due dates advancing by month index", () => {
      const start = new Date(2026, 0, 15);
      const period0 = calculatePeriodDueDate(start, 0, "monthly", "15");
      const period1 = calculatePeriodDueDate(start, 1, "monthly", "15");
      const period2 = calculatePeriodDueDate(start, 2, "monthly", "15");

      expect(period0.getMonth()).toBe(0);
      expect(period0.getDate()).toBe(15);
      expect(period1.getMonth()).toBe(1);
      expect(period1.getDate()).toBe(15);
      expect(period2.getMonth()).toBe(2);
      expect(period2.getDate()).toBe(15);
    });

    it("clamps dates to the last day for shorter months", () => {
      const start = new Date(2026, 0, 31);
      const febDueDate = calculatePeriodDueDate(start, 1, "monthly", "31");
      expect(febDueDate.getMonth()).toBe(1);
      expect(febDueDate.getDate()).toBe(28); // 2026 is non-leap year
    });

    it("handles 'last' day of month marker", () => {
      const start = new Date(2026, 0, 1);
      const janEnd = calculatePeriodDueDate(start, 0, "monthly", "last");
      const febEnd = calculatePeriodDueDate(start, 1, "monthly", "last");

      expect(janEnd.getDate()).toBe(31);
      expect(febEnd.getDate()).toBe(28);
    });
  });

  describe("formatDueDate", () => {
    it("formats dates into readable Month Day, Year strings", () => {
      const date = new Date(2026, 2, 15);
      expect(formatDueDate(date)).toBe("Mar 15, 2026");
    });
  });
});
