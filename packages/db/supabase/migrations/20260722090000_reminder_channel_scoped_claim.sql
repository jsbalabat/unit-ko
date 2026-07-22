-- Scope the once-per-day reminder slot to the channel.
--
-- claim_tenant_reminder has always accepted p_channel but its dedupe predicate
-- ignored it, so the slot was per-invoice-per-day across every channel at once.
-- That was invisible while email was the only sendable channel; the moment SMS
-- becomes real it means an email reminder silently blocks a same-day SMS
-- escalation on the same invoice, and the landlord sees a 429 they can't explain.
--
-- Hand-authored (forward-only): `supabase db diff` does not emit GRANT/REVOKE.
-- schemas/50_functions.sql carries the matching desired state.

create or replace function public.claim_tenant_reminder(
  p_landlord_id uuid,
  p_billing_entry_id uuid,
  p_channel text default 'email'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_landlord_check uuid;
  v_log_id uuid;
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;

  select p.landlord_id into v_landlord_check
  from public.billing_entries be
  join public.leases l on l.id = be.lease_id
  join public.properties p on p.id = l.property_id
  where be.id = p_billing_entry_id
  for update of be;
  if not found then raise exception 'billing entry not found'; end if;
  if v_landlord_check is distinct from p_landlord_id then
    raise exception 'not owned by landlord';
  end if;

  -- Only an active attempt (queued or already sent) on THIS channel holds today's
  -- slot; a prior failed attempt frees it for a same-day retry.
  if exists (
    select 1 from public.reminder_logs
    where billing_entry_id = p_billing_entry_id
      and channel_code = p_channel
      and created_at >= date_trunc('day', now())
      and status_code in ('pending', 'sent')
  ) then
    return null;
  end if;

  insert into public.reminder_logs (billing_entry_id, channel_code, status_code)
  values (p_billing_entry_id, p_channel, 'pending')
  returning id into v_log_id;
  return v_log_id;
end;
$$;

revoke execute on function public.claim_tenant_reminder(uuid, uuid, text) from public;
grant execute on function public.claim_tenant_reminder(uuid, uuid, text) to service_role;
