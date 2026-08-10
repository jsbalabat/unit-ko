-- Mint a public.profiles row for every new landlord at signup.
--
-- The handle_new_user() function ships in the init migration, but the trigger
-- that fires it lived only in seed.sql — and `supabase db push` applies
-- migrations, never seed.sql. So any db provisioned by push (i.e. production)
-- had the function but no trigger: sign-ups created an auth.users row with no
-- matching profile, breaking the app right after first login. `db diff` can't
-- manage the auth schema, so this is hand-authored, like the service_role grants.
--
-- Idempotent: safe to re-run and safe on databases that already have the trigger
-- (local dev, which created it via seed.sql before this migration existed).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
