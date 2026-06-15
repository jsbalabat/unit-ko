-- Drop the legacy / wide-open RLS policies on tenants and keep only the
-- landlord_id-based ones. Discovered 2026-05-07: pg_policies on `tenants`
-- showed three overlapping policy sets:
--   1) "Landlords can ... their own tenants"          (correct, landlord_id = auth.uid())
--   2) "Landlords can ... tenants of own properties"  (legacy, pre-landlord_id rollout)
--   3) "Users can ... tenants"                        (wide open, qualifier = true)
-- Postgres OR-merges policies, so (3) effectively disables the access check.
-- This migration drops (2) and (3) and reasserts (1) to be safe.
--
-- Run order: any time after add_landlord_id_to_tenants_and_unhoused_support.sql.
-- Idempotent: re-running is a no-op.

BEGIN;

-- (2) Legacy property-joined policies (drop)
DROP POLICY IF EXISTS "Landlords can view tenants of own properties" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can insert tenants for own properties" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can update tenants of own properties" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can delete tenants of own properties" ON public.tenants;

-- The earlier-pattern names from enable_rls_policies.sql, in case any survived.
DROP POLICY IF EXISTS "Landlords can view tenants of their properties" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can insert tenants for their properties" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can update tenants of their properties" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can delete tenants of their properties" ON public.tenants;

-- (3) Wide-open policies (drop)
DROP POLICY IF EXISTS "Users can view tenants" ON public.tenants;
DROP POLICY IF EXISTS "Users can insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Users can update tenants" ON public.tenants;
DROP POLICY IF EXISTS "Users can delete tenants" ON public.tenants;

-- (1) Reassert the correct policies (idempotent: drop+create)
DROP POLICY IF EXISTS "Landlords can view their own tenants" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can insert their own tenants" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can update their own tenants" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can delete their own tenants" ON public.tenants;

CREATE POLICY "Landlords can view their own tenants"
ON public.tenants FOR SELECT
TO authenticated
USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can insert their own tenants"
ON public.tenants FOR INSERT
TO authenticated
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can update their own tenants"
ON public.tenants FOR UPDATE
TO authenticated
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can delete their own tenants"
ON public.tenants FOR DELETE
TO authenticated
USING (landlord_id = auth.uid());

COMMIT;
