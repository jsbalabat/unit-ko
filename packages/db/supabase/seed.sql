-- Seed data, applied on every `supabase db reset`.
-- 1) Reference rows for every lookup table. Codes mirror packages/shared/src/enums.ts.
-- 2) The signup trigger on auth.users (kept here, not in schemas/, because
--    `supabase db diff` only manages the public schema).

-- ── Lookups ────────────────────────────────────────────────────────────────
insert into public.property_types (code, label) values
  ('Residential - Apartment', 'Residential - Apartment'),
  ('Residential - House', 'Residential - House'),
  ('Commercial - Office', 'Commercial - Office'),
  ('Commercial - Retail', 'Commercial - Retail')
on conflict (code) do nothing;

insert into public.billing_statuses (code, label, sort_order, is_settled) values
  ('Not Yet Set', 'Not Yet Set', 0, false),
  ('Not Yet Due', 'Not Yet Due', 1, false),
  ('Partial', 'Partial', 2, false),
  ('Paid', 'Paid', 3, true),
  ('Overdue', 'Overdue', 4, false)
on conflict (code) do nothing;

insert into public.billing_frequencies (code, label, interval_days) values
  ('weekly', 'Weekly', 7),
  ('bi-weekly', 'Bi-weekly', 14),
  ('monthly', 'Monthly', 30),
  ('quarterly', 'Quarterly', 91),
  ('semi-annually', 'Semi-annually', 182),
  ('annually', 'Annually', 365)
on conflict (code) do nothing;

insert into public.payment_types (code, label) values
  ('rent', 'Rent'),
  ('deposit', 'Deposit'),
  ('advance', 'Advance')
on conflict (code) do nothing;

insert into public.subscription_plans (code, name, property_limit, price) values
  ('free', 'Free', 3, 0),
  ('basic', 'Basic', 10, 299),
  ('premium', 'Premium', 50, 799),
  ('enterprise', 'Enterprise', 999, 1999)
on conflict (code) do nothing;

insert into public.subscription_statuses (code, label) values
  ('active', 'Active'),
  ('cancelled', 'Cancelled'),
  ('expired', 'Expired')
on conflict (code) do nothing;

insert into public.activity_action_types (code, label) values
  ('property_created', 'Property created'),
  ('property_updated', 'Property updated'),
  ('tenant_added', 'Tenant added'),
  ('tenant_updated', 'Tenant updated'),
  ('payment_made', 'Payment made'),
  ('billing_updated', 'Billing updated'),
  ('property_reset', 'Property reset'),
  ('property_note_added', 'Note added'),
  ('property_note_updated', 'Note updated'),
  ('property_note_deleted', 'Note deleted'),
  ('tenant_reminder_sent', 'Reminder sent'),
  ('legacy_event', 'Legacy event')
on conflict (code) do nothing;

insert into public.amenities (code, label) values
  ('wifi', 'Wi-Fi'),
  ('parking', 'Parking'),
  ('aircon', 'Air Conditioning'),
  ('water_included', 'Water Included'),
  ('electricity_included', 'Electricity Included'),
  ('laundry', 'Laundry'),
  ('kitchen', 'Kitchen'),
  ('security', 'Security / CCTV'),
  ('furnished', 'Furnished')
on conflict (code) do nothing;

-- ── Auth signup trigger ──────────────────────────────────────────────────────
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
