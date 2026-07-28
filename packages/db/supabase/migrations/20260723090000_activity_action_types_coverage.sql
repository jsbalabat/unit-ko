-- New activity action types for mutations that previously wrote no audit trail:
-- landlord profile changes (which include payout-destination changes — the most
-- security-relevant unlogged action), subscription plan changes, and both sides
-- of the tenant bill-response exchange.
--
-- Seeded here as well as in seed.sql because migrations run on prod while seed.sql
-- only runs on a local db:reset — the activity_logs FK must hold the moment the
-- API starts writing these codes.

insert into public.activity_action_types (code, label) values
  ('profile_updated', 'Profile updated'),
  ('subscription_updated', 'Subscription updated'),
  ('tenant_responded', 'Tenant responded'),
  ('response_confirmed', 'Response confirmed')
on conflict (code) do nothing;
