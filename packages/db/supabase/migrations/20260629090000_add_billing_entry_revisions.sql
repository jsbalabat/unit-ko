-- Per-edit audit trail for invoices. Each edit via update_billing_entry_atomic
-- snapshots the resulting rent_due + charge lines + recomputed status and the
-- editing landlord, giving every invoice a durable revision timeline that is
-- queryable on its own (not the best-effort activity log).
--
-- Hand-authored (forward-only): `supabase db diff` does not emit GRANTs/REVOKEs,
-- and we change a function body here, so this is not generated from schemas/.
-- schemas/40_billing.sql, 80_rls.sql and 50_functions.sql carry the matching
-- desired state.

create table public.billing_entry_revisions (
  id uuid primary key default gen_random_uuid(),
  billing_entry_id uuid not null references public.billing_entries(id) on delete cascade,
  rent_due numeric(12, 2) not null,
  charges jsonb not null default '[]'::jsonb,
  status_code text not null references public.billing_statuses(code),
  edited_by uuid references public.profiles(id) on delete set null,
  edited_at timestamptz not null default now()
);

create index idx_billing_entry_revisions_entry
  on public.billing_entry_revisions (billing_entry_id, edited_at desc);

-- Deny-by-default backstop; the API uses the service-role key (bypasses RLS).
alter table public.billing_entry_revisions enable row level security;

-- migra does not diff GRANTs; grant the sole API role explicitly.
grant all on public.billing_entry_revisions to service_role;

-- Recreate the edit function with a revision snapshot taken after the recompute,
-- so the captured row reflects the post-edit state.
create or replace function public.update_billing_entry_atomic(
  p_landlord_id uuid,
  p_entry_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_landlord_check uuid;
  v_charge jsonb;
  v_gross numeric;
  v_paid numeric;
  v_balance numeric;
  v_due date;
  v_new_status text;
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;

  select p.landlord_id into v_landlord_check
  from public.billing_entries be
  join public.leases l on l.id = be.lease_id
  join public.properties p on p.id = l.property_id
  where be.id = p_entry_id
  for update of be;
  if not found then raise exception 'billing entry not found'; end if;
  if v_landlord_check is distinct from p_landlord_id then
    raise exception 'not owned by landlord';
  end if;

  update public.billing_entries set
    due_date = case when p_payload ? 'dueDate'
      then coalesce(nullif(p_payload->>'dueDate', '')::date, due_date) else due_date end,
    rent_due = case when p_payload ? 'rentDue'
      then coalesce((p_payload->>'rentDue')::numeric, rent_due) else rent_due end,
    updated_at = now()
  where id = p_entry_id;

  if p_payload ? 'charges' then
    delete from public.billing_charges where billing_entry_id = p_entry_id;
    for v_charge in
      select * from jsonb_array_elements(coalesce(p_payload->'charges', '[]'::jsonb))
    loop
      if nullif(btrim(coalesce(v_charge->>'name', '')), '') is null then continue; end if;
      insert into public.billing_charges (billing_entry_id, name, amount)
      values (p_entry_id, v_charge->>'name', coalesce((v_charge->>'amount')::numeric, 0));
    end loop;
  end if;

  select gross_due, paid_amount, balance, due_date
  into v_gross, v_paid, v_balance, v_due
  from public.v_billing_entries_full
  where id = p_entry_id;

  v_new_status := case
    when coalesce(v_gross, 0) <= 0 then 'Not Yet Set'
    when coalesce(v_balance, 0) <= 0 then 'Paid'
    when coalesce(v_paid, 0) > 0 then 'Partial'
    when v_due is not null and v_due < current_date then 'Overdue'
    else 'Not Yet Due'
  end;

  update public.billing_entries set status_code = v_new_status, updated_at = now()
  where id = p_entry_id;

  insert into public.billing_entry_revisions (billing_entry_id, rent_due, charges, status_code, edited_by)
  select
    p_entry_id, be.rent_due,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', bc.name, 'amount', bc.amount) order by bc.created_at)
      from public.billing_charges bc where bc.billing_entry_id = p_entry_id
    ), '[]'::jsonb),
    be.status_code, p_landlord_id
  from public.billing_entries be
  where be.id = p_entry_id;
end;
$$;

revoke execute on function public.update_billing_entry_atomic(uuid, uuid, jsonb) from public;
grant execute on function public.update_billing_entry_atomic(uuid, uuid, jsonb) to service_role;
