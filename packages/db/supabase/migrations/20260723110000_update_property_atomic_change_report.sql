-- Make update_property_atomic *report what it changed* so the API can emit one
-- audit event per real change (tenant in / tenant out / details edited) instead
-- of a single opaque 'property_updated' row. One property update can, in a single
-- call, end leases, deactivate tenants, and insert brand-new tenants — previously
-- all of it collapsed to the string "Property updated: <name>" with no metadata,
-- so a tenant moving out was indistinguishable from a rent change.
--
-- Behaviour is otherwise unchanged: same mutations, same order. The only
-- difference is the richer jsonb return. Signature is unchanged, so this is a
-- plain create-or-replace. Grants re-asserted by hand (db diff strips them).

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
