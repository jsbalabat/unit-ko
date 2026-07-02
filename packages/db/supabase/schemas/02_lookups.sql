-- Reference/catalog tables. These replace the free-text "type/status" strings
-- that were previously duplicated across rows. Codes are the canonical values
-- shared with the API DTOs and UI (packages/shared/src/enums.ts); the rows
-- themselves are seeded in supabase/seed.sql.

create table public.property_types (
  code text primary key,
  label text not null
);

create table public.billing_statuses (
  code text primary key,
  label text not null,
  sort_order integer not null default 0,
  is_settled boolean not null default false   -- true for "Paid"-like statuses
);

create table public.billing_frequencies (
  code text primary key,
  label text not null,
  interval_days integer not null              -- drives billing-schedule generation
);

create table public.payment_types (
  code text primary key,
  label text not null
);

create table public.subscription_plans (
  code text primary key,
  name text not null,
  property_limit integer not null,            -- moves the hardcoded PLAN_LIMITS out of TS
  price numeric(12,2) not null default 0
);

create table public.subscription_statuses (
  code text primary key,
  label text not null
);

create table public.activity_action_types (
  code text primary key,
  label text not null
);

create table public.reminder_channels (
  code text primary key,
  label text not null
);

create table public.reminder_statuses (
  code text primary key,
  label text not null
);

create table public.amenities (
  code text primary key,
  label text not null
);
