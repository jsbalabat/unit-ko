-- Atomic once-per-day reminder claim. Replaces the legacy
-- billing_entries.last_reminded_at conditional update with a reminder_logs row.
-- Locks the billing entry (FOR UPDATE) so concurrent claims for the same entry
-- serialize, then inserts a log row only if none exists for today — returns
-- false if already reminded today. Verifies ownership; locked to service_role.
create or replace function public.claim_tenant_reminder(
  p_landlord_id uuid,
  p_billing_entry_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_landlord_check uuid;
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

  if exists (
    select 1 from public.reminder_logs
    where billing_entry_id = p_billing_entry_id
      and sent_at >= date_trunc('day', now())
  ) then
    return false;
  end if;

  insert into public.reminder_logs (billing_entry_id, channel, status)
  values (p_billing_entry_id, 'sms', 'sent');
  return true;
end;
$$;

revoke execute on function public.claim_tenant_reminder(uuid, uuid) from public;
grant execute on function public.claim_tenant_reminder(uuid, uuid) to service_role;
