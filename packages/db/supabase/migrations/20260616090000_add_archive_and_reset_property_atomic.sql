-- Archive a tenant and reset their slot on a property. Normalized port: instead
-- of snapshotting into archived_tenants and DELETING the tenant + billing (the
-- legacy behavior), we end the lease (status='ended' → it surfaces in the
-- v_archived_tenants view) and free the property by deactivating/unassigning the
-- tenant. Nothing is deleted, so the full history is preserved.
-- Takes the verified landlord id; locked to service_role.
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

  -- End the active lease (if any). Its property_id/tenant_id stay intact, so the
  -- v_archived_tenants view reconstructs the archive record from it.
  update public.leases
  set status = 'ended', ended_at = now(), end_reason = v_remarks, updated_at = now()
  where tenant_id = v_tenant_id and property_id = v_property_id and status = 'active'
  returning id into v_lease_id;

  -- Reset: drop the tenant from the active roster and free their property slot.
  update public.tenants
  set is_active = false, property_id = null, updated_at = now()
  where id = v_tenant_id;

  return jsonb_build_object('archived', true, 'leaseId', v_lease_id);
end;
$$;

revoke execute on function public.archive_and_reset_property_atomic(uuid, jsonb) from public;
grant execute on function public.archive_and_reset_property_atomic(uuid, jsonb) to service_role;
