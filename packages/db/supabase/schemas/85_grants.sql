-- Desired-state record of the API role's privileges. The API connects as
-- service_role and is the only database client; it bypasses RLS but still needs
-- explicit table/view/sequence/function privileges (Supabase's default
-- privileges don't cover tables our migrations create).
--
-- NOTE: `supabase db diff` (migra) does NOT diff GRANTs, so editing this file
-- will not generate a migration. The grants are applied by the hand-authored
-- migration 20260615184500_grant_service_role.sql. This file exists so the
-- intended privilege model lives alongside the rest of the schema.

grant usage on schema public to service_role;

grant all on all tables in schema public to service_role;       -- includes views
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
