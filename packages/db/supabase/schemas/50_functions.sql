-- Atomic, multi-table writes that must succeed or fail as a unit. Kept as
-- Postgres functions (true transactionality) and called from the API's
-- repositories.
--
-- IMPORTANT: these run under the API's service-role key, where auth.uid() is
-- NULL. The verified landlord id is therefore passed in as p_landlord_id (the
-- API derives it from the Supabase JWT, never from the request body). Execution
-- is restricted to service_role so an authenticated end-user cannot call the
-- function directly with an arbitrary landlord id.

-- The single source of truth for an invoice's status code, derived from its
-- figures. Used by v_billing_entries_full (so status is never stored) and by
-- update_billing_entry_atomic when it snapshots a revision. STABLE, not IMMUTABLE:
-- the overdue branch depends on current_date. Pure and data-free, so PUBLIC
-- execute (the default) is fine — no privileged data is reachable through it.
create or replace function public.billing_entry_status(
  p_gross numeric,
  p_paid numeric,
  p_balance numeric,
  p_due date
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when coalesce(p_gross, 0) <= 0 then 'Not Yet Set'
    when coalesce(p_balance, 0) <= 0 then 'Paid'
    when coalesce(p_paid, 0) > 0 then 'Partial'
    when p_due is not null and p_due < current_date then 'Overdue'
    else 'Not Yet Due'
  end;
$$;

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

      foreach v_lease_id in array v_lease_ids loop
        insert into billing_entries (
          lease_id, period_id, due_date, rent_due, sequence
        ) values (
          v_lease_id, v_period_id, (r_period.elem->>'dueDate')::date,
          coalesce((r_period.elem->>'rentDue')::numeric, 0),
          r_period.seq
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
  -- Change tracking for the audit trail: one entry per real change so the caller
  -- can log distinct tenant_removed / tenant_added / property_updated events.
  v_removed_tenants jsonb := '[]'::jsonb;
  v_added_tenants jsonb := '[]'::jsonb;
  v_changed jsonb := '[]'::jsonb;
  v_rt_name text;
  v_rt_lease_id uuid;
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
        where id = v_removed::uuid and property_id = p_property_id and landlord_id = p_landlord_id
        returning tenant_name into v_rt_name;
        -- Only report a removal that actually matched an owned tenant; the ended
        -- lease id and reason ride along so the event is self-contained.
        if found then
          v_rt_lease_id := null;
          update public.leases set status = 'ended', ended_at = now(),
            end_reason = v_end_reason, updated_at = now()
          where tenant_id = v_removed::uuid and status = 'active'
          returning id into v_rt_lease_id;
          v_removed_tenants := v_removed_tenants || jsonb_build_object(
            'tenantId', v_removed,
            'tenantName', v_rt_name,
            'leaseId', v_rt_lease_id,
            'endReason', v_end_reason
          );
        end if;
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

        v_added_tenants := v_added_tenants || jsonb_build_object(
          'tenantId', v_tenant.id,
          'tenantName', v_tenant.tenant_name
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

  -- Which non-tenant sections the landlord actually submitted, so the residual
  -- 'property_updated' event is specific instead of a blanket "something changed".
  if v_meta <> '{}'::jsonb then v_changed := v_changed || to_jsonb('details'::text); end if;
  if p_payload ? 'amenities' and jsonb_typeof(p_payload->'amenities') = 'array' then
    v_changed := v_changed || to_jsonb('amenities'::text);
  end if;
  if v_lease <> '{}'::jsonb then v_changed := v_changed || to_jsonb('lease'::text); end if;

  return jsonb_build_object(
    'propertyId', p_property_id,
    'changed', v_changed,
    'removedTenants', v_removed_tenants,
    'addedTenants', v_added_tenants
  );
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

-- Record a payment as a waterfall: settle the targeted invoice first, then the
-- lease's other unpaid invoices oldest-first (each capped at its remaining
-- balance), and book any surplus as an unallocated lease-level credit. This
-- keeps a single payment from overpaying one invoice into a negative balance and
-- makes the allocation authoritative for every caller. Deposit/advance are
-- lease-level facts and are never applied to an invoice. paid_amount/balance
-- stay derived. Each allocation records is_overflow (true when it cascaded onto
-- an invoice other than the targeted one) so the invoice history can flag it,
-- and the result carries propertyId + appliedCount + creditAmount for the
-- activity log. Locked to service_role.
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
  -- One id for every allocation this call books, so a reversal can void the whole
  -- payment as a unit.
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

  -- Surplus past every unpaid invoice becomes an unallocated lease-level credit
  -- rather than a negative invoice balance.
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

-- Reverse a recorded payment by soft-voiding its whole batch (the targeted
-- allocation, any waterfall overflow, and the surplus credit). Voided rows stay
-- in the ledger for audit but drop out of every derived sum, so paid_amount,
-- balance, credit and status recompute on their own — no figures to unwind by
-- hand. Verifies the batch belongs to the landlord and refuses a re-void. Returns
-- the ids the API needs for the activity log. Takes the verified landlord id;
-- locked to service_role.
create or replace function public.void_payment_atomic(
  p_landlord_id uuid,
  p_batch_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_landlord_check uuid;
  v_lease_id uuid;
  v_tenant_id uuid;
  v_property_id uuid;
  v_voided_count integer;
  v_entry_ids uuid[];
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;
  if p_batch_id is null then raise exception 'batch id is required'; end if;

  -- Resolve + lock the batch's owner from any one of its rows.
  select p.lease_id, p.tenant_id, pr.id, pr.landlord_id
  into v_lease_id, v_tenant_id, v_property_id, v_landlord_check
  from public.payments p
  join public.leases l on l.id = p.lease_id
  join public.properties pr on pr.id = l.property_id
  where p.batch_id = p_batch_id
  order by p.created_at
  limit 1
  for update of p;
  if not found then raise exception 'payment not found'; end if;
  if v_landlord_check is distinct from p_landlord_id then
    raise exception 'not owned by landlord';
  end if;

  update public.payments set
    voided_at = now(),
    voided_by = p_landlord_id,
    void_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where batch_id = p_batch_id and voided_at is null;
  get diagnostics v_voided_count = row_count;
  if v_voided_count = 0 then raise exception 'payment already voided'; end if;

  select array_agg(distinct billing_entry_id)
  into v_entry_ids
  from public.payments
  where batch_id = p_batch_id and billing_entry_id is not null;

  return jsonb_build_object(
    'batchId', p_batch_id,
    'leaseId', v_lease_id,
    'tenantId', v_tenant_id,
    'propertyId', v_property_id,
    'voidedCount', v_voided_count,
    'entryIds', coalesce(to_jsonb(v_entry_ids), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.void_payment_atomic(uuid, uuid, text) from public;
grant execute on function public.void_payment_atomic(uuid, uuid, text) to service_role;

-- Atomic once-per-day reminder claim, scoped to the channel. Locks the entry so
-- concurrent claims serialize, then inserts a 'pending' reminder_logs row and
-- returns its id — or null if today's slot for that channel is already held by an
-- active (pending/sent) attempt. A prior 'failed' attempt frees the slot for a
-- same-day retry, and email and SMS hold independent slots so one channel never
-- blocks the other. The dispatcher fills in the real outcome afterward. Locked to
-- service_role.
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

-- Move a tenant to another of the landlord's properties in one transaction: end the
-- current active lease (reason 'transferred', linked to the new lease), open a new
-- active lease on the destination carrying the old lease's terms, move the tenant
-- (property_id + next slot), and carry every still-open invoice's remaining balance
-- onto the new lease while soft-marking the originals transferred_at. Fully-paid
-- invoices stay on the source property as history. Returns the ids the API logs.
-- Takes the verified landlord id; locked to service_role.
create or replace function public.transfer_tenant_atomic(
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
  v_to_property_id uuid := nullif(p_payload->>'toPropertyId', '')::uuid;
  v_from_lease public.leases%rowtype;
  v_from_property_id uuid;
  v_to_owner uuid;
  v_to_max integer;
  v_to_lease_id uuid;
  v_next_slot integer;
  v_transferred_count integer := 0;
  v_entry record;
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;
  if v_tenant_id is null then raise exception 'tenantId is required'; end if;
  if v_to_property_id is null then raise exception 'toPropertyId is required'; end if;

  perform 1 from public.tenants
  where id = v_tenant_id and landlord_id = p_landlord_id for update;
  if not found then raise exception 'tenant not found'; end if;

  -- The source is the tenant's current active lease (uq_active_lease_per_tenant
  -- guarantees at most one).
  select * into v_from_lease from public.leases
  where tenant_id = v_tenant_id and status = 'active' for update;
  if not found then raise exception 'tenant has no active lease to transfer'; end if;
  v_from_property_id := v_from_lease.property_id;

  if v_from_property_id = v_to_property_id then
    raise exception 'tenant is already on this property';
  end if;

  select landlord_id, coalesce(max_tenants, 1) into v_to_owner, v_to_max
  from public.properties where id = v_to_property_id for update;
  if not found then raise exception 'destination property not found'; end if;
  if v_to_owner is distinct from p_landlord_id then
    raise exception 'destination property not owned by landlord';
  end if;

  -- Refuse if the destination is already at its tenant capacity.
  if (
    select count(*) from public.tenants
    where property_id = v_to_property_id and is_active
  ) >= v_to_max then
    raise exception 'destination property is full';
  end if;

  -- End the source lease first, so the one-active-lease-per-tenant constraint holds
  -- when the destination lease is opened.
  update public.leases
  set status = 'ended', ended_at = now(), end_reason = 'transferred', updated_at = now()
  where id = v_from_lease.id;

  insert into public.leases (
    property_id, tenant_id, billing_frequency_code, contract_periods,
    rent_amount, rent_start_date, rent_end_date, due_day,
    advance_payment, security_deposit, status
  ) values (
    v_to_property_id, v_tenant_id, v_from_lease.billing_frequency_code, v_from_lease.contract_periods,
    v_from_lease.rent_amount, v_from_lease.rent_start_date, v_from_lease.rent_end_date, v_from_lease.due_day,
    v_from_lease.advance_payment, v_from_lease.security_deposit, 'active'
  )
  returning id into v_to_lease_id;

  update public.leases set transferred_to_lease_id = v_to_lease_id, updated_at = now()
  where id = v_from_lease.id;

  select coalesce(max(tenant_slot), 0) + 1 into v_next_slot
  from public.tenants where property_id = v_to_property_id;

  update public.tenants
  set property_id = v_to_property_id, tenant_slot = v_next_slot, is_active = true, updated_at = now()
  where id = v_tenant_id;

  -- Carry each still-open invoice's remaining balance (credit-inclusive, net of
  -- cash) onto the new lease and soft-mark the original transferred. Fully-paid
  -- invoices (balance <= 0) are left on the source property untouched. The view is
  -- read once up front, so flagging inside the loop can't shift the balances.
  for v_entry in
    select id, due_date, sequence, balance
    from public.v_billing_entries_full
    where lease_id = v_from_lease.id and balance > 0 and transferred_at is null
  loop
    insert into public.billing_entries (lease_id, due_date, rent_due, sequence)
    values (v_to_lease_id, v_entry.due_date, v_entry.balance, v_entry.sequence);

    update public.billing_entries set transferred_at = now(), updated_at = now()
    where id = v_entry.id;

    v_transferred_count := v_transferred_count + 1;
  end loop;

  return jsonb_build_object(
    'tenantId', v_tenant_id,
    'fromPropertyId', v_from_property_id,
    'toPropertyId', v_to_property_id,
    'fromLeaseId', v_from_lease.id,
    'toLeaseId', v_to_lease_id,
    'transferredCount', v_transferred_count
  );
end;
$$;

revoke execute on function public.transfer_tenant_atomic(uuid, jsonb) from public;
grant execute on function public.transfer_tenant_atomic(uuid, jsonb) to service_role;

-- Propose a tenant transfer for the tenant to confirm — no data moves yet. Verifies
-- the landlord owns the tenant + destination and that the tenant has an active lease,
-- snapshots the source property/lease, and inserts a pending request. The partial
-- unique index (one pending per tenant) is the hard guard; the explicit check just
-- gives a cleaner error. Takes the verified landlord id; locked to service_role.
create or replace function public.create_transfer_request_atomic(
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
  v_to_property_id uuid := nullif(p_payload->>'toPropertyId', '')::uuid;
  v_from_lease public.leases%rowtype;
  v_from_property_id uuid;
  v_to_owner uuid;
  v_to_max integer;
  v_request_id uuid;
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;
  if v_tenant_id is null then raise exception 'tenantId is required'; end if;
  if v_to_property_id is null then raise exception 'toPropertyId is required'; end if;

  perform 1 from public.tenants
  where id = v_tenant_id and landlord_id = p_landlord_id;
  if not found then raise exception 'tenant not found'; end if;

  select * into v_from_lease from public.leases
  where tenant_id = v_tenant_id and status = 'active';
  if not found then raise exception 'tenant has no active lease to transfer'; end if;
  v_from_property_id := v_from_lease.property_id;

  if v_from_property_id = v_to_property_id then
    raise exception 'tenant is already on this property';
  end if;

  select landlord_id, coalesce(max_tenants, 1) into v_to_owner, v_to_max
  from public.properties where id = v_to_property_id;
  if not found then raise exception 'destination property not found'; end if;
  if v_to_owner is distinct from p_landlord_id then
    raise exception 'destination property not owned by landlord';
  end if;

  -- Refuse if the destination is already at its tenant capacity.
  if (
    select count(*) from public.tenants
    where property_id = v_to_property_id and is_active
  ) >= v_to_max then
    raise exception 'destination property is full';
  end if;

  if exists (
    select 1 from public.tenant_transfer_requests
    where tenant_id = v_tenant_id and status = 'pending'
  ) then
    raise exception 'a transfer is already pending for this tenant';
  end if;

  insert into public.tenant_transfer_requests (
    tenant_id, from_property_id, from_lease_id, to_property_id, status, created_by
  ) values (
    v_tenant_id, v_from_property_id, v_from_lease.id, v_to_property_id, 'pending', p_landlord_id
  )
  returning id into v_request_id;

  return jsonb_build_object(
    'requestId', v_request_id,
    'tenantId', v_tenant_id,
    'fromPropertyId', v_from_property_id,
    'toPropertyId', v_to_property_id,
    'fromLeaseId', v_from_lease.id,
    'status', 'pending'
  );
end;
$$;

revoke execute on function public.create_transfer_request_atomic(uuid, jsonb) from public;
grant execute on function public.create_transfer_request_atomic(uuid, jsonb) to service_role;

-- Resolve a pending transfer request as the tenant. On confirm, run the actual move
-- (transfer_tenant_atomic) and stamp 'confirmed' in one transaction; on reject, just
-- stamp 'rejected' and nothing moves. Verifies the request is pending and belongs to
-- the tenant, and that the tenant's lease hasn't changed since the proposal (else the
-- snapshot is stale). Takes the verified tenant id; locked to service_role.
create or replace function public.resolve_transfer_request_atomic(
  p_tenant_id uuid,
  p_request_id uuid,
  p_confirm boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.tenant_transfer_requests%rowtype;
  v_landlord_id uuid;
  v_transfer jsonb := null;
  v_new_status text;
begin
  if p_tenant_id is null then raise exception 'tenant id is required'; end if;
  if p_request_id is null then raise exception 'request id is required'; end if;

  select * into v_request from public.tenant_transfer_requests
  where id = p_request_id for update;
  if not found or v_request.tenant_id is distinct from p_tenant_id then
    raise exception 'transfer request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'transfer request already resolved';
  end if;

  if p_confirm then
    -- The proposal snapshot must still hold: the source lease is the tenant's current
    -- active one. If it changed, refuse rather than move under different conditions.
    if not exists (
      select 1 from public.leases
      where id = v_request.from_lease_id and tenant_id = p_tenant_id and status = 'active'
    ) then
      raise exception 'the tenant''s lease changed since this transfer was proposed';
    end if;

    select landlord_id into v_landlord_id from public.tenants where id = p_tenant_id;
    v_transfer := public.transfer_tenant_atomic(
      v_landlord_id,
      jsonb_build_object('tenantId', p_tenant_id, 'toPropertyId', v_request.to_property_id)
    );
    v_new_status := 'confirmed';
  else
    v_new_status := 'rejected';
  end if;

  update public.tenant_transfer_requests
  set status = v_new_status, resolved_at = now()
  where id = p_request_id;

  return jsonb_build_object(
    'requestId', p_request_id,
    'tenantId', p_tenant_id,
    'status', v_new_status,
    'fromPropertyId', v_request.from_property_id,
    'toPropertyId', v_request.to_property_id,
    'transfer', v_transfer
  );
end;
$$;

revoke execute on function public.resolve_transfer_request_atomic(uuid, uuid, boolean) from public;
grant execute on function public.resolve_transfer_request_atomic(uuid, uuid, boolean) to service_role;

-- Replace a landlord's full set of payout channels in one transaction: the API
-- sends the complete desired set, so anything omitted is removed. p_payload is
-- the payoutMethods array ([{method, accountName, accountNumber, details}]).
-- Takes the verified landlord id; locked to service_role.
create or replace function public.replace_landlord_payout_methods(
  p_landlord_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_method jsonb;
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;

  delete from public.landlord_payout_methods where landlord_id = p_landlord_id;

  for v_method in
    select * from jsonb_array_elements(coalesce(p_payload, '[]'::jsonb))
  loop
    if nullif(v_method->>'method', '') is null then continue; end if;
    insert into public.landlord_payout_methods
      (landlord_id, method, account_name, account_number, details)
    values (
      p_landlord_id,
      v_method->>'method',
      nullif(v_method->>'accountName', ''),
      nullif(v_method->>'accountNumber', ''),
      nullif(v_method->>'details', '')
    );
  end loop;
end;
$$;

revoke execute on function public.replace_landlord_payout_methods(uuid, jsonb) from public;
grant execute on function public.replace_landlord_payout_methods(uuid, jsonb) to service_role;

-- Edit one invoice: update its stored rent_due/due_date and replace its charge
-- lines (billing_charges). status_code is derived (v_billing_entries_full), so it
-- is not written back — only snapshotted into the revision via billing_entry_status
-- (other_charges/gross_due/paid_amount/balance stay derived too). Verifies the entry
-- belongs to the landlord. Takes the verified landlord id; locked to service_role.
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

  -- The edit itself already refreshed updated_at above; status is derived, so the
  -- only reason to recompute it here is the durable revision snapshot below.
  select gross_due, paid_amount, balance, due_date
  into v_gross, v_paid, v_balance, v_due
  from public.v_billing_entries_full
  where id = p_entry_id;

  v_new_status := public.billing_entry_status(v_gross, v_paid, v_balance, v_due);

  -- Durable per-edit history: snapshot the resulting state + the editing landlord.
  insert into public.billing_entry_revisions (billing_entry_id, rent_due, charges, status_code, edited_by)
  select
    p_entry_id, be.rent_due,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', bc.name, 'amount', bc.amount) order by bc.created_at)
      from public.billing_charges bc where bc.billing_entry_id = p_entry_id
    ), '[]'::jsonb),
    v_new_status, p_landlord_id
  from public.billing_entries be
  where be.id = p_entry_id;
end;
$$;

revoke execute on function public.update_billing_entry_atomic(uuid, uuid, jsonb) from public;
grant execute on function public.update_billing_entry_atomic(uuid, uuid, jsonb) to service_role;
