-- 20261025140000_atomic_assignment_and_rpc_fixes.sql
-- 1. Index on tenants for fast login credentials lookup
create index if not exists idx_tenants_credentials on public.tenants (contact_number, email);

-- 2. Atomic tenant assignment function
create or replace function public.assign_tenant_atomic(
  p_landlord_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tenant_id uuid := nullif(p_payload->>'tenantId', '')::uuid;
  v_property_id uuid := nullif(p_payload->>'propertyId', '')::uuid;
  v_prop_owner uuid;
  v_prop_max integer;
  v_unit_name text;
  v_next_slot integer;
  v_tenant public.tenants%rowtype;
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;
  if v_tenant_id is null then raise exception 'tenantId is required'; end if;
  if v_property_id is null then raise exception 'propertyId is required'; end if;

  select landlord_id, coalesce(max_tenants, 1), unit_name
  into v_prop_owner, v_prop_max, v_unit_name
  from public.properties
  where id = v_property_id and landlord_id = p_landlord_id
  for update;

  if not found then raise exception 'property not found'; end if;

  if (
    select count(*) from public.tenants
    where property_id = v_property_id and is_active
  ) >= v_prop_max then
    raise exception 'destination property is full';
  end if;

  select coalesce(max(tenant_slot), 0) + 1 into v_next_slot
  from public.tenants
  where property_id = v_property_id;

  update public.tenants
  set
    property_id = v_property_id,
    tenant_slot = v_next_slot,
    is_active = true,
    updated_at = now()
  where id = v_tenant_id
    and landlord_id = p_landlord_id
    and property_id is null
  returning * into v_tenant;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_tenant.id,
    'tenant_name', v_tenant.tenant_name,
    'email', v_tenant.email,
    'contact_number', v_tenant.contact_number,
    'property_id', v_tenant.property_id,
    'tenant_slot', v_tenant.tenant_slot,
    'is_active', v_tenant.is_active,
    'created_at', v_tenant.created_at,
    'properties', jsonb_build_object('unit_name', v_unit_name)
  );
end;
$$;

revoke execute on function public.assign_tenant_atomic(uuid, jsonb) from public;
grant execute on function public.assign_tenant_atomic(uuid, jsonb) to service_role;

-- 3. Update record_payment_atomic to lock lease row FOR UPDATE
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
  v_batch_id uuid := gen_random_uuid();
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'amount must be positive'; end if;

  if v_billing_entry_id is not null then
    select l.id, l.tenant_id, p.id, p.landlord_id
    into v_lease_id, v_tenant_id, v_property_id, v_landlord_check
    from public.billing_entries be
    join public.leases l on l.id = be.lease_id
    join public.properties p on p.id = l.property_id
    where be.id = v_billing_entry_id
    for update of l;
    if not found then raise exception 'billing entry not found'; end if;
  elsif v_lease_id is not null then
    select l.tenant_id, p.id, p.landlord_id
    into v_tenant_id, v_property_id, v_landlord_check
    from public.leases l
    join public.properties p on p.id = l.property_id
    where l.id = v_lease_id
    for update of l;
    if not found then raise exception 'lease not found'; end if;
  else
    raise exception 'billingEntryId or leaseId is required';
  end if;

  if v_landlord_check is distinct from p_landlord_id then
    raise exception 'not owned by landlord';
  end if;

  if v_payment_type in ('deposit', 'advance') then
    insert into public.payments (
      billing_entry_id, lease_id, tenant_id, payment_type_code, amount, paid_at, recorded_by, notes, is_overflow, batch_id
    ) values (
      null, v_lease_id, v_tenant_id, v_payment_type, v_amount, v_paid_at, p_landlord_id, v_notes, false, v_batch_id
    )
    returning id into v_first_payment_id;
    return jsonb_build_object(
      'paymentId', v_first_payment_id, 'billingEntryId', null,
      'propertyId', v_property_id, 'appliedCount', 0, 'creditAmount', 0
    );
  end if;

  v_remaining := v_amount;

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

      if v_billing_entry_id is not null then
        v_is_overflow := v_ids[v_i] is distinct from v_billing_entry_id;
      else
        v_is_overflow := v_primary_assigned;
      end if;
      v_primary_assigned := true;

      insert into public.payments (
        billing_entry_id, lease_id, tenant_id, payment_type_code, amount, paid_at, recorded_by, notes, is_overflow, batch_id
      ) values (
        v_ids[v_i], v_lease_id, v_tenant_id, v_payment_type, v_apply, v_paid_at, p_landlord_id, v_notes, v_is_overflow, v_batch_id
      )
      returning id into v_pid;

      if v_first_payment_id is null then
        v_first_payment_id := v_pid;
        v_first_entry_id := v_ids[v_i];
      end if;

      v_applied_count := v_applied_count + 1;
      v_remaining := v_remaining - v_apply;
    end loop;
  end if;

  if v_remaining > 0 then
    v_credit := v_remaining;
    insert into public.payments (
      billing_entry_id, lease_id, tenant_id, payment_type_code, amount, paid_at, recorded_by, notes, is_overflow, batch_id
    ) values (
      null, v_lease_id, v_tenant_id, v_payment_type, v_remaining, v_paid_at, p_landlord_id, v_notes, true, v_batch_id
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

-- 4. Update claim_tenant_reminder to use Asia/Manila timezone
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

  if exists (
    select 1 from public.reminder_logs
    where billing_entry_id = p_billing_entry_id
      and channel_code = p_channel
      and created_at >= (date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila')
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
