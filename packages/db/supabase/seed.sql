-- Seed data, applied only on local `supabase db reset` (never runs on `db push`).
-- Holds ONLY the local-dev landlord — a credential we must never put in a real
-- environment. Lookup/reference data that every environment needs lives in a
-- forward migration (20260811090000_seed_reference_data.sql); the auth.users
-- signup trigger in 20260810120000_auth_signup_trigger.sql.

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
