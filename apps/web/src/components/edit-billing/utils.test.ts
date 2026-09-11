import { describe, expect, it } from "vitest";
import {
  chargesSignature,
  formatDateTime,
  paymentTypeLabel,
  peso,
  sumCharges,
} from "./types";

describe("edit-billing utilities", () => {
  describe("peso", () => {
    it("formats numbers into Philippine Peso strings with 2 decimals", () => {
      expect(peso(0)).toBe("₱0.00");
      expect(peso(1500)).toBe("₱1,500.00");
      expect(peso(25000.5)).toBe("₱25,000.50");
    });
  });

  describe("paymentTypeLabel", () => {
    it("returns mapped human-readable labels", () => {
      expect(paymentTypeLabel("rent")).toBe("Rent");
      expect(paymentTypeLabel("deposit")).toBe("Deposit");
      expect(paymentTypeLabel("advance")).toBe("Advance");
      expect(paymentTypeLabel("custom")).toBe("custom");
    });
  });

  describe("chargesSignature and sumCharges", () => {
    it("generates deterministic signature string", () => {
      const charges = [
        { name: "Water", amount: 250 },
        { name: "Electricity", amount: 1200 },
      ];
      expect(chargesSignature(charges)).toBe("Water:250|Electricity:1200");
    });

    it("sums charge items accurately", () => {
      const charges = [
        { name: "Water", amount: 250 },
        { name: "Electricity", amount: 1200.5 },
      ];
      expect(sumCharges(charges)).toBe(1450.5);
      expect(sumCharges([])).toBe(0);
    });
  });

  describe("formatDateTime", () => {
    it("returns dash for invalid timestamps", () => {
      expect(formatDateTime("invalid")).toBe("—");
    });

    it("formats valid ISO timestamp", () => {
      const formatted = formatDateTime("2026-05-15T10:30:00Z");
      expect(formatted).toContain("2026");
      expect(formatted).toContain("May");
    });
  });
});
