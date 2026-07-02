-- Payment allocation traceability. The waterfall (20260701090000) can split one
-- recorded payment across several invoices, but nothing said which allocations
-- cascaded in from an overpayment vs. the one the landlord targeted, so the SOA
-- history couldn't flag them and payment activity was attributed to no property.
-- This adds payments.is_overflow (a recording-time fact per allocation) and has
-- record_payment_atomic set it and return propertyId + appliedCount +
-- creditAmount so the activity log can attribute and describe the payment.
--
-- Hand-authored (forward-only): `supabase db diff` does not emit GRANTs/REVOKEs
-- and we recreate a function body here. schemas/40_billing.sql and
-- schemas/50_functions.sql carry the matching desired state.

alter table public.payments
  add column is_overflow boolean not null default false;

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
  v_property_id uuid;
  v_landlord_check uuid;
  v_remaining numeric;
  v_apply numeric;
  v_ids uuid[];
  v_bals numeric[];
  v_i integer;
  v_pid uuid;
  v_first_payment_id uuid;
  v_first_entry_id uuid;
  v_applied_count integer := 0;
  v_credit numeric := 0;
  v_is_overflow boolean;
  v_primary_assigned boolean := false;
  v_gross numeric;
  v_paid numeric;
  v_balance numeric;
  v_due date;
  v_new_status text;
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'amount must be positive'; end if;

  if v_billing_entry_id is not null then
    select l.id, l.tenant_id, p.id, p.landlord_id
    into v_lease_id, v_tenant_id, v_property_id, v_landlord_check
    from public.billing_entries be
    join public.leases l on l.id = be.lease_id
    join public.properties p on p.id = l.property_id
    where be.id = v_billing_entry_id;
    if not found then raise exception 'billing entry not found'; end if;
  elsif v_lease_id is not null then
    select l.tenant_id, p.id, p.landlord_id
    into v_tenant_id, v_property_id, v_landlord_check
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

  -- Deposit/advance are lease-level ledger facts; they never reduce an invoice
  -- balance, so record a single unallocated row and return.
  if v_payment_type in ('deposit', 'advance') then
    insert into public.payments (
      billing_entry_id, lease_id, tenant_id, payment_type_code, amount, paid_at, recorded_by, notes, is_overflow
    ) values (
      null, v_lease_id, v_tenant_id, v_payment_type, v_amount, v_paid_at, p_landlord_id, v_notes, false
    )
    returning id into v_first_payment_id;
    return jsonb_build_object(
      'paymentId', v_first_payment_id, 'billingEntryId', null,
      'propertyId', v_property_id, 'appliedCount', 0, 'creditAmount', 0
    );
  end if;

  v_remaining := v_amount;

  -- Ordered claim list: the targeted invoice (ord 0) ahead of the lease's other
  -- unpaid invoices (ord 1), then oldest-first within each. The two array_aggs
  -- share one order expression so ids and balances stay paired.
  select
    array_agg(t.id order by t.ord, t.due_date asc nulls last, t.sequence asc nulls last, t.id),
    array_agg(t.balance order by t.ord, t.due_date asc nulls last, t.sequence asc nulls last, t.id)
  into v_ids, v_bals
  from (
    select id, balance, due_date, sequence,
      case when id = v_billing_entry_id then 0 else 1 end as ord
    from public.v_billing_entries_full
    where lease_id = v_lease_id and balance > 0
  ) t;

  if v_ids is not null then
    for v_i in 1 .. array_length(v_ids, 1) loop
      exit when v_remaining <= 0;
      v_apply := least(v_remaining, v_bals[v_i]);
      if v_apply <= 0 then continue; end if;

      -- An allocation is a waterfall overflow when it lands on an invoice other
      -- than the one the landlord targeted; with no explicit target, only the
      -- first (oldest) invoice is the primary and the rest overflow.
      if v_billing_entry_id is not null then
        v_is_overflow := v_ids[v_i] is distinct from v_billing_entry_id;
      else
        v_is_overflow := v_primary_assigned;
      end if;
      v_primary_assigned := true;

      insert into public.payments (
        billing_entry_id, lease_id, tenant_id, payment_type_code, amount, paid_at, recorded_by, notes, is_overflow
      ) values (
        v_ids[v_i], v_lease_id, v_tenant_id, v_payment_type, v_apply, v_paid_at, p_landlord_id, v_notes, v_is_overflow
      )
      returning id into v_pid;

      if v_first_payment_id is null then
        v_first_payment_id := v_pid;
        v_first_entry_id := v_ids[v_i];
      end if;

      v_applied_count := v_applied_count + 1;
      v_remaining := v_remaining - v_apply;

      select gross_due, paid_amount, balance, due_date
      into v_gross, v_paid, v_balance, v_due
      from public.v_billing_entries_full
      where id = v_ids[v_i];

      v_new_status := case
        when coalesce(v_gross, 0) <= 0 then 'Not Yet Set'
        when coalesce(v_balance, 0) <= 0 then 'Paid'
        when coalesce(v_paid, 0) > 0 then 'Partial'
        when v_due is not null and v_due < current_date then 'Overdue'
        else 'Not Yet Due'
      end;

      update public.billing_entries
      set status_code = v_new_status, updated_at = now()
      where id = v_ids[v_i];
    end loop;
  end if;

  -- Surplus past every unpaid invoice becomes an unallocated lease-level credit
  -- rather than a negative invoice balance.
  if v_remaining > 0 then
    v_credit := v_remaining;
    insert into public.payments (
      billing_entry_id, lease_id, tenant_id, payment_type_code, amount, paid_at, recorded_by, notes, is_overflow
    ) values (
      null, v_lease_id, v_tenant_id, v_payment_type, v_remaining, v_paid_at, p_landlord_id, v_notes, true
    )
    returning id into v_pid;
    if v_first_payment_id is null then v_first_payment_id := v_pid; end if;
  end if;

  return jsonb_build_object(
    'paymentId', v_first_payment_id, 'billingEntryId', v_first_entry_id,
    'propertyId', v_property_id, 'appliedCount', v_applied_count, 'creditAmount', v_credit
  );
end;
$$;

revoke execute on function public.record_payment_atomic(uuid, jsonb) from public;
grant execute on function public.record_payment_atomic(uuid, jsonb) to service_role;
