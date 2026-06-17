-- Edit one invoice atomically: update stored rent_due/due_date, replace its
-- charge lines, then recompute status_code from the derived figures. Runs under
-- the service-role key with the verified landlord id passed in (auth.uid() is
-- NULL there). Hand-authored: `supabase db diff` does not emit the revoke/grant,
-- so it's included here and execution is locked to service_role.
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
end;
$$;

revoke execute on function public.update_billing_entry_atomic(uuid, uuid, jsonb) from public;
grant execute on function public.update_billing_entry_atomic(uuid, uuid, jsonb) to service_role;
