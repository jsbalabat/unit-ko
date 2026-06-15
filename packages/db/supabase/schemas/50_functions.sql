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
