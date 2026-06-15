-- Cleanup of RLS policy soup discovered 2026-05-07. Three families of issues:
--
-- 1) Wide-open "Users can ..." policies (qual = true) on billing_entries and
--    properties. These OR-merge with the landlord-gated policies and silently
--    disable access control. Drop on sight.
--
-- 2) Duplicate landlord-gated policies under different names. Both flavors gate
--    correctly (`landlord_id = auth.uid()` or the equivalent EXISTS join), so
--    behavior is unchanged. Consolidating to a single canonical name reduces
--    confusion and makes future cleanups predictable. Canonical name pattern
--    follows enable_rls_policies.sql ("their own properties", "billing entries
--    of their properties", "their archived tenants").
--
-- 3) profiles."Service role has full access" is left alone here — it must be
--    inspected first to confirm it's TO service_role only. Cleanup query for
--    that one is at the bottom of this file (commented out).
--
-- Run order: any time after add_landlord_id_to_tenants_and_unhoused_support.sql.
-- Idempotent.

BEGIN;

-- =====================================================================
-- billing_entries
-- =====================================================================

-- Wide-open
DROP POLICY IF EXISTS "Users can view billing entries"   ON public.billing_entries;
DROP POLICY IF EXISTS "Users can insert billing entries" ON public.billing_entries;
DROP POLICY IF EXISTS "Users can update billing entries" ON public.billing_entries;
DROP POLICY IF EXISTS "Users can delete billing entries" ON public.billing_entries;

-- Duplicate landlord-gated (drop the "for own properties" flavor)
DROP POLICY IF EXISTS "Landlords can view billing for own properties"   ON public.billing_entries;
DROP POLICY IF EXISTS "Landlords can insert billing for own properties" ON public.billing_entries;
DROP POLICY IF EXISTS "Landlords can update billing for own properties" ON public.billing_entries;
DROP POLICY IF EXISTS "Landlords can delete billing for own properties" ON public.billing_entries;

-- Reassert canonical
DROP POLICY IF EXISTS "Landlords can view billing entries of their properties"   ON public.billing_entries;
DROP POLICY IF EXISTS "Landlords can insert billing entries for their properties" ON public.billing_entries;
DROP POLICY IF EXISTS "Landlords can update billing entries of their properties" ON public.billing_entries;
DROP POLICY IF EXISTS "Landlords can delete billing entries of their properties" ON public.billing_entries;

CREATE POLICY "Landlords can view billing entries of their properties"
ON public.billing_entries FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties
    WHERE properties.id = billing_entries.property_id
      AND properties.landlord_id = auth.uid()
  )
);

CREATE POLICY "Landlords can insert billing entries for their properties"
ON public.billing_entries FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties
    WHERE properties.id = billing_entries.property_id
      AND properties.landlord_id = auth.uid()
  )
);

CREATE POLICY "Landlords can update billing entries of their properties"
ON public.billing_entries FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties
    WHERE properties.id = billing_entries.property_id
      AND properties.landlord_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties
    WHERE properties.id = billing_entries.property_id
      AND properties.landlord_id = auth.uid()
  )
);

CREATE POLICY "Landlords can delete billing entries of their properties"
ON public.billing_entries FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties
    WHERE properties.id = billing_entries.property_id
      AND properties.landlord_id = auth.uid()
  )
);

-- =====================================================================
-- properties
-- =====================================================================

-- Wide-open
DROP POLICY IF EXISTS "Users can view their properties"   ON public.properties;
DROP POLICY IF EXISTS "Users can insert properties"       ON public.properties;
DROP POLICY IF EXISTS "Users can update their properties" ON public.properties;
DROP POLICY IF EXISTS "Users can delete their properties" ON public.properties;

-- Duplicate landlord-gated (drop the "own properties" flavor — same logic, shorter name)
DROP POLICY IF EXISTS "Landlords can view own properties"   ON public.properties;
DROP POLICY IF EXISTS "Landlords can insert own properties" ON public.properties;
DROP POLICY IF EXISTS "Landlords can update own properties" ON public.properties;
DROP POLICY IF EXISTS "Landlords can delete own properties" ON public.properties;

-- Reassert canonical
DROP POLICY IF EXISTS "Landlords can view their own properties"   ON public.properties;
DROP POLICY IF EXISTS "Landlords can insert their own properties" ON public.properties;
DROP POLICY IF EXISTS "Landlords can update their own properties" ON public.properties;
DROP POLICY IF EXISTS "Landlords can delete their own properties" ON public.properties;

CREATE POLICY "Landlords can view their own properties"
ON public.properties FOR SELECT
TO authenticated
USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can insert their own properties"
ON public.properties FOR INSERT
TO authenticated
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can update their own properties"
ON public.properties FOR UPDATE
TO authenticated
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can delete their own properties"
ON public.properties FOR DELETE
TO authenticated
USING (landlord_id = auth.uid());

-- =====================================================================
-- archived_tenants — only duplicate names, no wide-open policies
-- =====================================================================

DROP POLICY IF EXISTS "Landlords can view own archives"   ON public.archived_tenants;
DROP POLICY IF EXISTS "Landlords can insert own archives" ON public.archived_tenants;

-- The "their archived tenants" flavor stays. Reassert defensively.
DROP POLICY IF EXISTS "Landlords can view their archived tenants"   ON public.archived_tenants;
DROP POLICY IF EXISTS "Landlords can insert their archived tenants" ON public.archived_tenants;
DROP POLICY IF EXISTS "Landlords can update their archived tenants" ON public.archived_tenants;
DROP POLICY IF EXISTS "Landlords can delete their archived tenants" ON public.archived_tenants;

CREATE POLICY "Landlords can view their archived tenants"
ON public.archived_tenants FOR SELECT
TO authenticated
USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can insert their archived tenants"
ON public.archived_tenants FOR INSERT
TO authenticated
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can update their archived tenants"
ON public.archived_tenants FOR UPDATE
TO authenticated
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can delete their archived tenants"
ON public.archived_tenants FOR DELETE
TO authenticated
USING (landlord_id = auth.uid());

COMMIT;

-- =====================================================================
-- profiles."Service role has full access" — DO NOT RUN unless the role
-- inspection query confirms the policy applies to {public} or {authenticated}
-- (i.e. NOT restricted to {service_role}).
-- =====================================================================
-- DROP POLICY IF EXISTS "Service role has full access" ON public.profiles;
