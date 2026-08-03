// Pure formatting helpers for the activity-log metadata renderer, split out from
// the presentational component so they can be unit-tested without a DOM.

// Friendly labels for the metadata keys the API writes. Anything not listed falls
// back to a camelCase-split of the key itself.
const KEY_LABELS: Record<string, string> = {
  billingEntryId: "Invoice",
  responseId: "Response",
  noteId: "Note",
  recipient: "Recipient",
  channel: "Channel",
  status: "Status",
  error: "Error",
  responseType: "Response",
  endReason: "Reason",
  changed: "Sections",
  plan: "Plan",
  fields: "Fields changed",
  unhoused: "Unhoused",
  tenants: "Tenants",
  billingPeriods: "Billing periods",
};

export function humanizeKey(key: string): string {
  return (
    KEY_LABELS[key] ??
    key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/^./, (c) => c.toUpperCase())
  );
}

export function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// The metadata entries worth showing: blanks (null / undefined / "") are dropped
// so a log with only empty fields renders no disclosure at all.
export function visibleMetadataEntries(
  metadata: Record<string, unknown>,
): [string, unknown][] {
  return Object.entries(metadata).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
}

// Reference-id keys (camelCase ending in "Id", e.g. noteId, billingEntryId) are
// foreign keys into other tables. They're the audit anchor, so they stay — but
// the renderer shows them compact (see shortenId) with the full value on hover.
export function isReferenceId(key: string): boolean {
  return /Id$/.test(key);
}

// The scannable form of a UUID reference: "#" plus its first segment. The full
// id is still surfaced by the renderer (on hover) so audit precision is intact.
export function shortenId(value: string): string {
  const [first] = value.split("-");
  return `#${first}`;
}
