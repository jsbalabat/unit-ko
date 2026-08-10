-- Lookup/reference data the application depends on in EVERY environment.
--
-- These rows previously lived only in seed.sql, which `supabase db push` never
-- runs — so any db provisioned by push (i.e. production) had empty lookup tables.
-- Every insert that references one (a property's type, its amenities, an activity
-- log's action type, a subscription's plan …) then failed its foreign key with a
-- 500. Reference data isn't user data: it's part of the deployable schema and
-- belongs in a migration. Codes mirror packages/shared/src/enums.ts.
--
-- Idempotent (`on conflict do nothing`): safe to re-run and safe on databases
-- that already have these rows (local dev, seeded before this migration existed).

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
  ('Overdue', 'Overdue', 4, false),
  ('Transferred', 'Transferred', 5, true)
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
  ('tenant_removed', 'Tenant removed'),
  ('tenant_transferred', 'Tenant transferred'),
  ('tenant_transfer_proposed', 'Transfer proposed'),
  ('tenant_transfer_rejected', 'Transfer rejected'),
  ('tenant_transfer_cancelled', 'Transfer cancelled'),
  ('profile_updated', 'Profile updated'),
  ('subscription_updated', 'Subscription updated'),
  ('tenant_responded', 'Tenant responded'),
  ('response_confirmed', 'Response confirmed'),
  ('payment_voided', 'Payment voided'),
  ('legacy_event', 'Legacy event')
on conflict (code) do nothing;

insert into public.reminder_channels (code, label) values
  ('email', 'Email'),
  ('sms', 'SMS')
on conflict (code) do nothing;

insert into public.reminder_statuses (code, label) values
  ('pending', 'Pending'),
  ('sent', 'Sent'),
  ('failed', 'Failed')
on conflict (code) do nothing;

insert into public.tenant_response_types (code, label) values
  ('acknowledged', 'Acknowledged'),
  ('will_pay', 'Will pay'),
  ('already_paid', 'Already paid'),
  ('disputed', 'Dispute')
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
