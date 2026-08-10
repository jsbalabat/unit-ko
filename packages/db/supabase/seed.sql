-- Seed data, applied on every `supabase db reset`.
-- Reference rows for every lookup table (codes mirror packages/shared/src/enums.ts)
-- plus a local-dev landlord. The auth.users signup trigger is NOT here anymore —
-- it lives in a forward migration (20260810120000_auth_signup_trigger.sql) so
-- `db push` carries it to every environment; this file never runs remotely.

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

-- ── Local dev landlord ───────────────────────────────────────────────────────
-- A known account so `db reset` always leaves a working login (otherwise every
-- reset wipes auth.users → 400 "Invalid login credentials"). LOCAL DEV ONLY —
-- never seed a credential into a real environment.
--
-- Password login needs three things GoTrue would normally create: a bcrypt
-- `encrypted_password` (pgcrypto lives in the `extensions` schema), a confirmed
-- email, and an `auth.identities` row for the email provider. The signup trigger
-- (from the migration, applied before this seed runs) mints the matching
-- public.profiles row. Guarded by NOT EXISTS so a re-run is a no-op.
-- Login → dev@unitko.test / devpassword123
with dev_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  select
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
    'authenticated', 'authenticated', 'dev@unitko.test',
    extensions.crypt('devpassword123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Dev Landlord"}'::jsonb, now(), now(),
    '', '', '', ''
  where not exists (select 1 from auth.users where email = 'dev@unitko.test')
  returning id, email
)
insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  id::text, id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email', now(), now(), now()
from dev_user;

-- Flesh out the trigger-created profile (separate statement so it sees the row
-- the trigger inserted during the auth.users write above).
update public.profiles
   set full_name = 'Dev Landlord', username = 'dev'
 where email = 'dev@unitko.test';
