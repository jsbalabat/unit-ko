-- Tighten the activity_logs INSERT policy.
--
-- Current policy: WITH CHECK (auth.uid() IS NOT NULL) — any authenticated user
-- can insert any activity log on any property/tenant. That lets a tenant or a
-- different landlord forge audit entries against properties they don't own.
--
-- New policy requires the actor to:
--   1) claim themselves as user_id (no spoofing as another user),
--   2) only attach to a property they own (or none), and
--   3) only attach to a tenant they own (or none).
--
-- Both atomic RPCs (create_unhoused_tenant_atomic, archive_and_reset_property_atomic)
-- and the client-side logActivity service already meet these constraints.
--
-- Idempotent.

BEGIN;

DROP POLICY IF EXISTS "Authenticated users can create activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Landlords can create activity logs for their data" ON public.activity_logs;

CREATE POLICY "Landlords can create activity logs for their data"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  -- Actor must claim themselves (or leave it NULL for system-level inserts the
  -- service makes when there is no current Supabase session — none today, but
  -- harmless to allow).
  (user_id IS NULL OR user_id = auth.uid())

  -- If a property is referenced, the auth user must own it.
  AND (
    property_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = activity_logs.property_id
        AND landlord_id = auth.uid()
    )
  )

  -- If a tenant is referenced, the auth user must own it (covers unhoused
  -- tenants where property_id is NULL but tenant_id is set).
  AND (
    tenant_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.tenants
      WHERE id = activity_logs.tenant_id
        AND landlord_id = auth.uid()
    )
  )
);

COMMIT;
