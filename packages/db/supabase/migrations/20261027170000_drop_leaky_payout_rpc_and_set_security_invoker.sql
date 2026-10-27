-- Drop dead, publicly executable SECURITY DEFINER function that leaks payout credentials.
drop function if exists public.get_landlord_payout_methods(uuid);

-- Ensure views invoke security of caller rather than view owner.
alter view public.v_billing_entries_full set (security_invoker = true);
alter view public.v_lease_credit set (security_invoker = true);
alter view public.v_property_occupancy set (security_invoker = true);
alter view public.v_archived_tenants set (security_invoker = true);
alter view public.v_reminder_logs_full set (security_invoker = true);
alter view public.v_tenant_responses_full set (security_invoker = true);
