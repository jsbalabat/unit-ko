-- Record a payment in the ledger and recompute the affected invoice's status,
-- atomically. paid_amount/balance themselves stay derived (v_billing_entries_full);
-- only status_code (a stored, displayed field) is refreshed here.
-- Resolves lease/tenant from the entry (or lease) and verifies the property is
-- owned by the caller. Takes the verified landlord id; locked to service_role.
-- Hand-authored (db diff strips the grants).
create or replace function public.record_payment_atomic(
  p_landlord_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_billing_entry_id uuid := nullif(p_payload->>'billingEntryId', '')::uuid;
  v_lease_id uuid := nullif(p_payload->>'leaseId', '')::uuid;
  v_amount numeric := (p_payload->>'amount')::numeric;
  v_payment_type text := coalesce(nullif(p_payload->>'paymentType', ''), 'rent');
  v_paid_at timestamptz := coalesce(nullif(p_payload->>'paidAt', '')::timestamptz, now());
  v_notes text := nullif(p_payload->>'notes', '');
  v_tenant_id uuid;
  v_landlord_check uuid;
  v_payment payments%rowtype;
  v_gross numeric;
  v_paid numeric;
  v_balance numeric;
  v_due date;
  v_new_status text;
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'amount must be positive'; end if;

  -- Resolve lease + tenant and confirm ownership.
  if v_billing_entry_id is not null then
    select l.id, l.tenant_id, p.landlord_id
    into v_lease_id, v_tenant_id, v_landlord_check
    from public.billing_entries be
    join public.leases l on l.id = be.lease_id
    join public.properties p on p.id = l.property_id
    where be.id = v_billing_entry_id;
    if not found then raise exception 'billing entry not found'; end if;
  elsif v_lease_id is not null then
    select l.tenant_id, p.landlord_id
    into v_tenant_id, v_landlord_check
    from public.leases l
    join public.properties p on p.id = l.property_id
    where l.id = v_lease_id;
    if not found then raise exception 'lease not found'; end if;
  else
    raise exception 'billingEntryId or leaseId is required';
  end if;

  if v_landlord_check is distinct from p_landlord_id then
    raise exception 'not owned by landlord';
  end if;

  insert into public.payments (
    billing_entry_id, lease_id, tenant_id, payment_type_code, amount, paid_at, recorded_by, notes
  ) values (
    v_billing_entry_id, v_lease_id, v_tenant_id, v_payment_type, v_amount, v_paid_at, p_landlord_id, v_notes
  )
  returning * into v_payment;

  -- Refresh the invoice status from the now-updated derived view.
  if v_billing_entry_id is not null then
    select gross_due, paid_amount, balance, due_date
    into v_gross, v_paid, v_balance, v_due
    from public.v_billing_entries_full
    where id = v_billing_entry_id;

    v_new_status := case
      when coalesce(v_gross, 0) <= 0 then 'Not Yet Set'
      when coalesce(v_balance, 0) <= 0 then 'Paid'
      when coalesce(v_paid, 0) > 0 then 'Partial'
      when v_due is not null and v_due < current_date then 'Overdue'
      else 'Not Yet Due'
    end;

    update public.billing_entries
    set status_code = v_new_status, updated_at = now()
    where id = v_billing_entry_id;
  end if;

  return jsonb_build_object('paymentId', v_payment.id, 'billingEntryId', v_billing_entry_id);
end;
$$;

revoke execute on function public.record_payment_atomic(uuid, jsonb) from public;
grant execute on function public.record_payment_atomic(uuid, jsonb) to service_role;
