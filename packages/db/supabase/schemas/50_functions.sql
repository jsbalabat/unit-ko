-- Atomic, multi-table writes that must succeed or fail as a unit. Kept as
-- Postgres functions (true transactionality) and called from the API's
-- repositories.
--
-- IMPORTANT: these run under the API's service-role key, where auth.uid() is
-- NULL. The verified landlord id is therefore passed in as p_landlord_id (the
-- API derives it from the Supabase JWT, never from the request body). Execution
-- is restricted to service_role so an authenticated end-user cannot call the
-- function directly with an arbitrary landlord id.

-- Create a property and, optionally, its tenants + active leases + billing
-- schedule in one transaction. Returns the new property id and a few counts;
-- the API re-reads the full detail through the normal read path.
create or replace function public.create_property_atomic(
  p_landlord_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_property properties%rowtype;
  v_tenant tenants%rowtype;
  v_lease leases%rowtype;
  v_entry billing_entries%rowtype;
  v_amenity text;
  v_tenant_json jsonb;
  v_charge jsonb;
  v_slot integer := 0;
  v_lease_ids uuid[] := array[]::uuid[];
  v_lease_id uuid;
  v_period_id uuid;
  v_status text;
  r_period record;

  v_billing_frequency text := coalesce(nullif(p_payload->'lease'->>'billingFrequency', ''), 'monthly');
  v_interval_days integer;
  v_rent_start date := nullif(p_payload->'lease'->>'rentStartDate', '')::date;
  v_contract_periods integer := nullif(p_payload->'lease'->>'contractPeriods', '')::integer;
  v_due_day smallint := nullif(p_payload->'lease'->>'dueDay', '')::smallint;
  v_lease_rent numeric := coalesce(
    (p_payload->'lease'->>'rentAmount')::numeric,
    (p_payload->>'rentAmount')::numeric,
    0
  );
  v_advance numeric := coalesce((p_payload->'lease'->>'advancePayment')::numeric, 0);
  v_deposit numeric := coalesce((p_payload->'lease'->>'securityDeposit')::numeric, 0);
  v_rent_end date;

  v_tenant_count integer := 0;
  v_entry_count integer := 0;
begin
  if p_landlord_id is null then
    raise exception 'landlord id is required';
  end if;

  -- Derive a rent end date from the chosen frequency's interval (best-effort;
  -- left null if the inputs aren't all present).
  select interval_days into v_interval_days
  from billing_frequencies where code = v_billing_frequency;

  if v_rent_start is not null and v_contract_periods is not null and v_interval_days is not null then
    v_rent_end := v_rent_start + (v_contract_periods * v_interval_days);
  end if;

  insert into properties (
    landlord_id, unit_name, property_type_code, property_location,
    rent_amount, max_tenants, billing_mode, lease_date
  ) values (
    p_landlord_id,
    p_payload->>'unitName',
    nullif(p_payload->>'propertyType', ''),
    nullif(p_payload->>'propertyLocation', ''),
    coalesce((p_payload->>'rentAmount')::numeric, 0),
    coalesce((p_payload->>'maxTenants')::integer, 1),
    coalesce(nullif(p_payload->>'billingMode', ''), 'unified'),
    nullif(p_payload->>'leaseDate', '')::date
  )
  returning * into v_property;

  -- Amenities → junction rows.
  if jsonb_typeof(p_payload->'amenities') = 'array' then
    for v_amenity in select jsonb_array_elements_text(p_payload->'amenities') loop
      if coalesce(btrim(v_amenity), '') <> '' then
        insert into property_amenities (property_id, amenity_code)
        values (v_property.id, v_amenity)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  -- Each tenant gets an identity row plus one active lease carrying the terms.
  if jsonb_typeof(p_payload->'tenants') = 'array' then
    for v_tenant_json in select value from jsonb_array_elements(p_payload->'tenants') loop
      if coalesce(btrim(v_tenant_json->>'tenantName'), '') = '' then
        continue;
      end if;
      v_slot := v_slot + 1;

      insert into tenants (
        landlord_id, property_id, tenant_name, email, contact_number, tenant_slot, is_active
      ) values (
        p_landlord_id, v_property.id,
        v_tenant_json->>'tenantName',
        nullif(v_tenant_json->>'email', ''),
        coalesce(v_tenant_json->>'contactNumber', ''),
        v_slot, true
      )
      returning * into v_tenant;

      insert into leases (
        property_id, tenant_id, billing_frequency_code, contract_periods,
        rent_amount, rent_start_date, rent_end_date, due_day,
        advance_payment, security_deposit, status
      ) values (
        v_property.id, v_tenant.id, v_billing_frequency, v_contract_periods,
        v_lease_rent, v_rent_start, v_rent_end, v_due_day,
        v_advance, v_deposit, 'active'
      )
      returning * into v_lease;

      v_lease_ids := array_append(v_lease_ids, v_lease.id);
      v_tenant_count := v_tenant_count + 1;
    end loop;
  end if;

  -- Billing schedule: one period per schedule row, one invoice per lease in that
  -- period. Charges become billing_charges rows (other_charges is SUM(amount)).
  if array_length(v_lease_ids, 1) is not null
     and jsonb_typeof(p_payload->'billingSchedule') = 'array' then
    for r_period in
      select elem, ordinality::integer as seq
      from jsonb_array_elements(p_payload->'billingSchedule') with ordinality as t(elem, ordinality)
    loop
      insert into billing_periods (property_id, sequence, due_date)
      values (v_property.id, r_period.seq, (r_period.elem->>'dueDate')::date)
      returning id into v_period_id;

      v_status := case
        when coalesce((r_period.elem->>'rentDue')::numeric, 0) <= 0
             and jsonb_array_length(coalesce(r_period.elem->'charges', '[]'::jsonb)) = 0
          then 'Not Yet Set'
        else coalesce(nullif(r_period.elem->>'status', ''), 'Not Yet Due')
      end;

      foreach v_lease_id in array v_lease_ids loop
        insert into billing_entries (
          lease_id, period_id, due_date, rent_due, status_code, sequence
        ) values (
          v_lease_id, v_period_id, (r_period.elem->>'dueDate')::date,
          coalesce((r_period.elem->>'rentDue')::numeric, 0),
          v_status, r_period.seq
        )
        returning * into v_entry;

        v_entry_count := v_entry_count + 1;

        if jsonb_typeof(r_period.elem->'charges') = 'array' then
          for v_charge in select value from jsonb_array_elements(r_period.elem->'charges') loop
            insert into billing_charges (billing_entry_id, name, amount)
            values (
              v_entry.id,
              coalesce(nullif(v_charge->>'name', ''), 'Charge'),
              coalesce((v_charge->>'amount')::numeric, 0)
            );
          end loop;
        end if;
      end loop;
    end loop;
  end if;

  return jsonb_build_object(
    'propertyId', v_property.id,
    'tenantCount', v_tenant_count,
    'billingEntryCount', v_entry_count
  );
end;
$$;

-- Only the API (service_role) may execute this: it trusts p_landlord_id, so an
-- authenticated end-user must not be able to call it with someone else's id.
revoke execute on function public.create_property_atomic(uuid, jsonb) from public;
grant execute on function public.create_property_atomic(uuid, jsonb) to service_role;

-- Atomic property update: meta + amenities (replace) + tenant add/update/remove
-- (ending leases on removal) + lease-term updates on active leases. Takes the
-- verified landlord id as a parameter; locked to service_role.
create or replace function public.update_property_atomic(
  p_landlord_id uuid,
  p_property_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_property properties%rowtype;
  v_meta jsonb := coalesce(p_payload->'property', '{}'::jsonb);
  v_lease jsonb := coalesce(p_payload->'lease', '{}'::jsonb);
  v_amenity text;
  v_occupant jsonb;
  v_removed text;
  v_existing_id uuid;
  v_tenant tenants%rowtype;
  v_max_slot integer;
  v_end_reason text := coalesce(nullif(p_payload->>'endReason', ''), 'Removed via property update');
  v_billing_frequency text := coalesce(nullif(v_lease->>'billingFrequency', ''), 'monthly');
  v_interval_days integer;
  v_rent_start date := nullif(v_lease->>'rentStartDate', '')::date;
  v_contract_periods integer := nullif(v_lease->>'contractPeriods', '')::integer;
  v_due_day smallint := nullif(v_lease->>'dueDay', '')::smallint;
  v_advance numeric := coalesce((v_lease->>'advancePayment')::numeric, 0);
  v_deposit numeric := coalesce((v_lease->>'securityDeposit')::numeric, 0);
  v_rent_end date;
  v_lease_rent numeric;
begin
  if p_landlord_id is null then
    raise exception 'landlord id is required';
  end if;

  select * into v_property from public.properties
  where id = p_property_id and landlord_id = p_landlord_id
  for update;
  if not found then
    raise exception 'property not found or not owned by landlord';
  end if;

  update public.properties set
    unit_name = coalesce(nullif(v_meta->>'unitName', ''), unit_name),
    property_type_code = case when v_meta ? 'propertyType'
      then nullif(v_meta->>'propertyType', '') else property_type_code end,
    property_location = case when v_meta ? 'propertyLocation'
      then nullif(v_meta->>'propertyLocation', '') else property_location end,
    rent_amount = coalesce((v_meta->>'rentAmount')::numeric, rent_amount),
    max_tenants = coalesce((v_meta->>'maxTenants')::integer, max_tenants),
    billing_mode = coalesce(nullif(v_meta->>'billingMode', ''), billing_mode),
    lease_date = case when v_meta ? 'leaseDate'
      then nullif(v_meta->>'leaseDate', '')::date else lease_date end,
    updated_at = now()
  where id = p_property_id;

  if p_payload ? 'amenities' and jsonb_typeof(p_payload->'amenities') = 'array' then
    delete from public.property_amenities where property_id = p_property_id;
    for v_amenity in select jsonb_array_elements_text(p_payload->'amenities') loop
      if coalesce(btrim(v_amenity), '') <> '' then
        insert into public.property_amenities (property_id, amenity_code)
        values (p_property_id, v_amenity) on conflict do nothing;
      end if;
    end loop;
  end if;

  if jsonb_typeof(p_payload->'removedTenantIds') = 'array' then
    for v_removed in select jsonb_array_elements_text(p_payload->'removedTenantIds') loop
      if coalesce(v_removed, '') <> '' then
        update public.tenants set is_active = false, updated_at = now()
        where id = v_removed::uuid and property_id = p_property_id and landlord_id = p_landlord_id;
        update public.leases set status = 'ended', ended_at = now(),
          end_reason = v_end_reason, updated_at = now()
        where tenant_id = v_removed::uuid and status = 'active';
      end if;
    end loop;
  end if;

  select interval_days into v_interval_days
  from public.billing_frequencies where code = v_billing_frequency;
  if v_rent_start is not null and v_contract_periods is not null and v_interval_days is not null then
    v_rent_end := v_rent_start + (v_contract_periods * v_interval_days);
  end if;

  select coalesce(max(tenant_slot), 0) into v_max_slot
  from public.tenants where property_id = p_property_id;

  if jsonb_typeof(p_payload->'occupants') = 'array' then
    for v_occupant in select value from jsonb_array_elements(p_payload->'occupants') loop
      v_existing_id := nullif(v_occupant->>'id', '')::uuid;
      if v_existing_id is not null then
        update public.tenants set
          tenant_name = coalesce(nullif(v_occupant->>'tenantName', ''), tenant_name),
          email = case when v_occupant ? 'email' then nullif(v_occupant->>'email', '') else email end,
          contact_number = coalesce(nullif(v_occupant->>'contactNumber', ''), contact_number),
          is_active = true,
          updated_at = now()
        where id = v_existing_id and property_id = p_property_id and landlord_id = p_landlord_id;
      else
        if coalesce(btrim(v_occupant->>'tenantName'), '') = '' then continue; end if;
        v_max_slot := v_max_slot + 1;
        v_lease_rent := coalesce((v_lease->>'rentAmount')::numeric, v_property.rent_amount, 0);

        insert into public.tenants (
          landlord_id, property_id, tenant_name, email, contact_number, tenant_slot, is_active
        ) values (
          p_landlord_id, p_property_id, v_occupant->>'tenantName',
          nullif(v_occupant->>'email', ''), coalesce(v_occupant->>'contactNumber', ''),
          v_max_slot, true
        )
        returning * into v_tenant;

        insert into public.leases (
          property_id, tenant_id, billing_frequency_code, contract_periods,
          rent_amount, rent_start_date, rent_end_date, due_day,
          advance_payment, security_deposit, status
        ) values (
          p_property_id, v_tenant.id, v_billing_frequency, v_contract_periods,
          v_lease_rent, v_rent_start, v_rent_end, v_due_day, v_advance, v_deposit, 'active'
        );
      end if;
    end loop;
  end if;

  if v_lease <> '{}'::jsonb then
    update public.leases set
      billing_frequency_code = case when v_lease ? 'billingFrequency'
        then coalesce(nullif(v_lease->>'billingFrequency', ''), billing_frequency_code) else billing_frequency_code end,
      contract_periods = case when v_lease ? 'contractPeriods'
        then nullif(v_lease->>'contractPeriods', '')::integer else contract_periods end,
      rent_amount = case when v_lease ? 'rentAmount'
        then coalesce((v_lease->>'rentAmount')::numeric, rent_amount) else rent_amount end,
      rent_start_date = case when v_lease ? 'rentStartDate'
        then nullif(v_lease->>'rentStartDate', '')::date else rent_start_date end,
      due_day = case when v_lease ? 'dueDay'
        then nullif(v_lease->>'dueDay', '')::smallint else due_day end,
      advance_payment = case when v_lease ? 'advancePayment'
        then coalesce((v_lease->>'advancePayment')::numeric, advance_payment) else advance_payment end,
      security_deposit = case when v_lease ? 'securityDeposit'
        then coalesce((v_lease->>'securityDeposit')::numeric, security_deposit) else security_deposit end,
      updated_at = now()
    where property_id = p_property_id and status = 'active';
  end if;

  return jsonb_build_object('propertyId', p_property_id);
end;
$$;

revoke execute on function public.update_property_atomic(uuid, uuid, jsonb) from public;
grant execute on function public.update_property_atomic(uuid, uuid, jsonb) to service_role;

-- Add a tenant (identity only), optionally assigned to a property. No lease is
-- created, so occupancy (derived from active leases) is unaffected; soft
-- capacity (no max_tenants enforcement). Locked to service_role.
create or replace function public.create_unhoused_tenant_atomic(
  p_landlord_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tenant_name text := btrim(coalesce(p_payload->>'tenantName', ''));
  v_email text := nullif(btrim(coalesce(p_payload->>'email', '')), '');
  v_contact text := btrim(coalesce(p_payload->>'contactNumber', ''));
  v_property_id uuid := nullif(p_payload->>'propertyId', '')::uuid;
  v_property properties%rowtype;
  v_tenant tenants%rowtype;
  v_next_slot integer;
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;
  if v_tenant_name = '' then raise exception 'tenant name is required'; end if;
  if v_contact = '' then raise exception 'contact number is required'; end if;

  if v_property_id is not null then
    select * into v_property from public.properties
    where id = v_property_id and landlord_id = p_landlord_id
    for update;
    if not found then
      raise exception 'property not found or not owned by landlord';
    end if;
    select coalesce(max(tenant_slot), 0) + 1 into v_next_slot
    from public.tenants where property_id = v_property_id;
  end if;

  insert into public.tenants (
    landlord_id, property_id, tenant_name, email, contact_number, tenant_slot, is_active
  ) values (
    p_landlord_id, v_property_id, v_tenant_name, v_email, v_contact, v_next_slot, true
  )
  returning * into v_tenant;

  return jsonb_build_object('tenantId', v_tenant.id);
end;
$$;

revoke execute on function public.create_unhoused_tenant_atomic(uuid, jsonb) from public;
grant execute on function public.create_unhoused_tenant_atomic(uuid, jsonb) to service_role;

-- Record a payment (ledger insert) and refresh the invoice's status_code from
-- the derived view. paid_amount/balance remain derived. Locked to service_role.
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

-- Atomic once-per-day reminder claim (reminder_logs replaces last_reminded_at).
-- Locks the entry so concurrent claims serialize; returns false if already
-- reminded today. Locked to service_role.
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

-- Archive a tenant + reset their property slot: end the active lease (→ surfaces
-- in v_archived_tenants) and deactivate/unassign the tenant. No deletes; history
-- is preserved relationally. Locked to service_role.
create or replace function public.archive_and_reset_property_atomic(
  p_landlord_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_property_id uuid := nullif(p_payload->>'propertyId', '')::uuid;
  v_tenant_id uuid := nullif(p_payload->>'tenantId', '')::uuid;
  v_remarks text := nullif(btrim(coalesce(p_payload->>'remarks', '')), '');
  v_property properties%rowtype;
  v_tenant tenants%rowtype;
  v_lease_id uuid;
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;
  if v_property_id is null or v_tenant_id is null then
    raise exception 'property and tenant are required';
  end if;
  if v_remarks is null or length(v_remarks) < 10 then
    raise exception 'remarks must be at least 10 characters';
  end if;

  select * into v_property from public.properties
  where id = v_property_id and landlord_id = p_landlord_id
  for update;
  if not found then raise exception 'property not found'; end if;

  select * into v_tenant from public.tenants
  where id = v_tenant_id and property_id = v_property_id and landlord_id = p_landlord_id
  for update;
  if not found then raise exception 'tenant not found on this property'; end if;

  update public.leases
  set status = 'ended', ended_at = now(), end_reason = v_remarks, updated_at = now()
  where tenant_id = v_tenant_id and property_id = v_property_id and status = 'active'
  returning id into v_lease_id;

  update public.tenants
  set is_active = false, property_id = null, updated_at = now()
  where id = v_tenant_id;

  return jsonb_build_object('archived', true, 'leaseId', v_lease_id);
end;
$$;

revoke execute on function public.archive_and_reset_property_atomic(uuid, jsonb) from public;
grant execute on function public.archive_and_reset_property_atomic(uuid, jsonb) to service_role;
