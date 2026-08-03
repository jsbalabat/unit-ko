import { describe, expect, it } from "vitest";
import {
  formatValue,
  humanizeKey,
  isReferenceId,
  shortenId,
  visibleMetadataEntries,
} from "./activity-log-format";

describe("humanizeKey", () => {
  it("uses the friendly label for a known key", () => {
    expect(humanizeKey("billingEntryId")).toBe("Invoice");
    expect(humanizeKey("changed")).toBe("Sections");
  });

  it("splits and capitalizes an unknown camelCase key", () => {
    expect(humanizeKey("someUnknownKey")).toBe("Some Unknown Key");
    expect(humanizeKey("createdAt")).toBe("Created At");
  });

  it("capitalizes a single unknown word", () => {
    expect(humanizeKey("reason")).toBe("Reason");
  });
});

describe("formatValue", () => {
  it("renders booleans as Yes/No", () => {
    expect(formatValue(true)).toBe("Yes");
    expect(formatValue(false)).toBe("No");
  });

  it("renders numbers with locale grouping", () => {
    expect(formatValue(1500)).toBe((1500).toLocaleString());
  });

  it("joins arrays with commas", () => {
    expect(formatValue(["meta", "amenities"])).toBe("meta, amenities");
  });

  it("stringifies nested objects", () => {
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
  });

  it("stringifies other primitives", () => {
    expect(formatValue("plain")).toBe("plain");
  });
});

describe("visibleMetadataEntries", () => {
  it("drops null, undefined and empty-string values", () => {
    expect(
      visibleMetadataEntries({
        keep: "yes",
        blank: "",
        missing: null,
        absent: undefined,
        falsey: false,
        zero: 0,
      }),
    ).toEqual([
      ["keep", "yes"],
      ["falsey", false],
      ["zero", 0],
    ]);
  });

  it("returns an empty list when every value is blank", () => {
    expect(visibleMetadataEntries({ a: "", b: null })).toEqual([]);
  });
});

describe("isReferenceId", () => {
  it("matches camelCase keys ending in Id", () => {
    expect(isReferenceId("noteId")).toBe(true);
    expect(isReferenceId("billingEntryId")).toBe(true);
    expect(isReferenceId("responseId")).toBe(true);
  });

  it("does not match human-content keys", () => {
    expect(isReferenceId("message")).toBe(false);
    expect(isReferenceId("changed")).toBe(false);
    expect(isReferenceId("plan")).toBe(false);
  });
});

describe("shortenId", () => {
  it("keeps the first UUID segment behind a # prefix", () => {
    expect(shortenId("7f3a1c2e-9b04-4d1a-8f22-2a9f1c0d4e5b")).toBe("#7f3a1c2e");
  });
});
