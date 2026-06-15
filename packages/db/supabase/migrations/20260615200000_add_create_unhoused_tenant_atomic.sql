-- Add a tenant (identity only), optionally assigned to a property. Normalized
-- port of the legacy create_unhoused_tenant_atomic:
--   * No profiles insert (tenant identity lives on `tenants`).
--   * No occupancy_status flip — occupancy derives from active leases. A quick-
--     added tenant is an assignment, not a lease; the property only becomes
--     "occupied" once a lease exists.
--   * Soft capacity: inserts past max_tenants are allowed (it's informational).
-- Takes the verified landlord id as a parameter; locked to service_role.
-- Hand-authored (db diff strips the grants).
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

  -- Housed: validate ownership and pick the next slot. Unhoused: slot stays null.
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
