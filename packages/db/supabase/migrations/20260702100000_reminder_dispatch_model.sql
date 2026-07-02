-- Day 3: real reminder dispatch model. reminder_logs was a fiction — the claim
-- inserted status='sent' before anything was sent. This introduces a proper
-- lifecycle (pending → sent | failed), an explicit channel (email | sms), and
-- delivery columns, so the dispatcher can record the TRUE outcome. Channel and
-- status become lookup tables per the 3NF convention. claim_tenant_reminder now
-- inserts a 'pending' row and returns its id (or null when today's slot is held
-- by an active attempt); a prior 'failed' attempt frees the slot for a retry.
--
-- Hand-authored (forward-only): `supabase db diff` does not emit GRANT/REVOKE and
-- we change a function's body + signature. schemas/02_lookups.sql, 40_billing.sql
-- and 50_functions.sql carry the matching desired state; seed.sql seeds the new
-- lookups for local dev.

create table public.reminder_channels (
  code text primary key,
  label text not null
);

create table public.reminder_statuses (
  code text primary key,
  label text not null
);

-- Seed here too (seed.sql only runs on local db:reset), so the FKs below hold on
-- an already-populated database and prod has the codes.
insert into public.reminder_channels (code, label) values
  ('email', 'Email'), ('sms', 'SMS')
on conflict (code) do nothing;

insert into public.reminder_statuses (code, label) values
  ('pending', 'Pending'), ('sent', 'Sent'), ('failed', 'Failed')
on conflict (code) do nothing;

-- Evolve reminder_logs: name the lookup columns *_code, default to the new
-- email-first / pending model, add delivery columns, and let sent_at stay null
-- until a dispatch is accepted. Existing rows already hold valid codes
-- ('sms'/'sent'), so the FKs validate without a backfill.
alter table public.reminder_logs rename column channel to channel_code;
alter table public.reminder_logs rename column status to status_code;

alter table public.reminder_logs
  alter column channel_code set default 'email',
  alter column status_code set default 'pending',
  alter column sent_at drop not null,
  alter column sent_at drop default,
  add column last_error text,
  add column delivered_at timestamptz;

alter table public.reminder_logs
  add constraint reminder_logs_channel_code_fkey
    foreign key (channel_code) references public.reminder_channels(code),
  add constraint reminder_logs_status_code_fkey
    foreign key (status_code) references public.reminder_statuses(code);

drop index if exists public.idx_reminder_logs_entry;
create index idx_reminder_logs_entry
  on public.reminder_logs (billing_entry_id, created_at);

-- Return type + signature change → drop before recreate (create-or-replace can't
-- change a function's return type).
drop function if exists public.claim_tenant_reminder(uuid, uuid);

create function public.claim_tenant_reminder(
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

  -- Only an active attempt (queued or already sent) holds today's slot; a prior
  -- failed attempt frees it for a same-day retry.
  if exists (
    select 1 from public.reminder_logs
    where billing_entry_id = p_billing_entry_id
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
