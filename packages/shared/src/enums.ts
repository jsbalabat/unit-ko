// Canonical lookup codes shared by the database seed, the API DTOs, and the UI.
// Centralized here so the same string values cannot drift apart across layers —
// each list mirrors a lookup table seeded in packages/db.

export const ROLES = ["landlord", "tenant"] as const;
export type Role = (typeof ROLES)[number];

export const OCCUPANCY_STATUSES = ["occupied", "vacant"] as const;
export type OccupancyStatus = (typeof OCCUPANCY_STATUSES)[number];

export const BILLING_MODES = ["unified", "per_tenant"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

export const BILLING_FREQUENCIES = [
  "weekly",
  "bi-weekly",
  "monthly",
  "quarterly",
  "semi-annually",
  "annually",
] as const;
export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];

export const BILLING_STATUSES = [
  "Not Yet Set",
  "Not Yet Due",
  "Partial",
  "Paid",
  "Overdue",
] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export const PAYMENT_TYPES = ["rent", "deposit", "advance"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const SUBSCRIPTION_PLANS = ["free", "basic", "premium", "enterprise"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const SUBSCRIPTION_STATUSES = ["active", "cancelled", "expired"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// A landlord's payment-receiving channels (mirrors the landlord_payout_methods
// CHECK constraint). One row per method per landlord.
export const PAYOUT_METHODS = ["bank", "gcash", "paymaya", "other"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

// Reminder dispatch channel + lifecycle (mirror reminder_channels /
// reminder_statuses). A reminder_logs row walks pending → sent | failed.
export const REMINDER_CHANNELS = ["email", "sms"] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const REMINDER_STATUSES = ["pending", "sent", "failed"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const TENANT_RESPONSE_TYPES = [
  "acknowledged",
  "will_pay",
  "already_paid",
  "disputed",
] as const;
export type TenantResponseType = (typeof TENANT_RESPONSE_TYPES)[number];

export const ACTIVITY_ACTION_TYPES = [
  "property_created",
  "property_updated",
  "tenant_added",
  "tenant_updated",
  "payment_made",
  "billing_updated",
  "property_reset",
  "property_note_added",
  "property_note_updated",
  "property_note_deleted",
  "tenant_reminder_sent",
  "profile_updated",
  "subscription_updated",
  "tenant_responded",
  "response_confirmed",
  "legacy_event",
] as const;
export type ActivityActionType = (typeof ACTIVITY_ACTION_TYPES)[number];
