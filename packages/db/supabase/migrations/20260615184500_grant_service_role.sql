-- The API is the sole database client and connects as service_role (via the
-- service/secret key). It bypasses RLS but still needs table/view/sequence/
-- function privileges — and Supabase's default privileges do NOT cover the
-- tables our migrations create. Note: `supabase db diff` (migra) does not diff
-- GRANTs/ALTER DEFAULT PRIVILEGES, so this is hand-authored and forward-only.
-- RLS (20260612... / 80_rls) remains the deny-by-default backstop for any other
-- role; only service_role is granted broad access here.

grant usage on schema public to service_role;

grant all on all tables in schema public to service_role;       -- includes views
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Cover objects added by future migrations too (applies to objects created by
-- the migration role).
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
