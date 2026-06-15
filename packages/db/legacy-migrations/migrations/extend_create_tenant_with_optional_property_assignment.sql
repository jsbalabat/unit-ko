-- Extend create_unhoused_tenant_atomic so the Add Tenant dialog can optionally
-- assign the tenant to a property at creation time. When propertyId is provided
-- the RPC validates landlord ownership, picks the next free tenant_slot, and
-- flips the property to 'occupied' if it was vacant. Lease fields stay NULL —
-- the lease itself is set later via the property edit flow.
--
-- Run order: after add_landlord_id_to_tenants_and_unhoused_support.sql,
-- before zz_canonicalize_atomic_rpc_functions.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_unhoused_tenant_atomic(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_tenant_name TEXT := btrim(COALESCE(payload->>'tenantName', ''));
  v_email TEXT := COALESCE(payload->>'tenantEmail', '');
  v_contact TEXT := btrim(COALESCE(payload->>'contactNumber', ''));
  v_property_id UUID := NULLIF(payload->>'propertyId', '')::UUID;
  v_tenant tenants%ROWTYPE;
  v_property properties%ROWTYPE;
  v_active_tenant_count INTEGER := 0;
  v_max_tenants INTEGER := 1;
  v_next_slot INTEGER := 1;
  v_max_existing_slot INTEGER;
  v_log_property_id UUID := NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF v_tenant_name = '' THEN
    RAISE EXCEPTION 'Tenant name is required';
  END IF;

  IF v_contact = '' THEN
    RAISE EXCEPTION 'Contact number is required';
  END IF;

  -- If a property was selected, validate ownership and slot availability.
  IF v_property_id IS NOT NULL THEN
    SELECT *
    INTO v_property
    FROM properties
    WHERE id = v_property_id
      AND landlord_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Property not found or not owned by current user';
    END IF;

    v_max_tenants := COALESCE(v_property.max_tenants, 1);

    SELECT COUNT(*)
    INTO v_active_tenant_count
    FROM tenants
    WHERE property_id = v_property_id
      AND is_active = TRUE;

    IF v_active_tenant_count >= v_max_tenants THEN
      RAISE EXCEPTION 'Property is fully occupied (% of % slots filled)', v_active_tenant_count, v_max_tenants;
    END IF;

    SELECT COALESCE(MAX(tenant_slot), 0)
    INTO v_max_existing_slot
    FROM tenants
    WHERE property_id = v_property_id;

    v_next_slot := COALESCE(v_max_existing_slot, 0) + 1;
    v_log_property_id := v_property_id;
  END IF;

  INSERT INTO tenants (
    landlord_id,
    property_id,
    tenant_name,
    email,
    contact_number,
    tenant_slot,
    pax,
    pax_details,
    contract_months,
    rent_start_date,
    due_day,
    billing_frequency,
    rent_per_person,
    is_active,
    advance_payment,
    security_deposit,
    overflow,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_property_id,
    v_tenant_name,
    v_email,
    v_contact,
    v_next_slot,
    1,
    jsonb_build_array(
      jsonb_build_object(
        'name', v_tenant_name,
        'email', v_email,
        'phone', v_contact
      )
    ),
    NULL,
    NULL,
    NULL,
    'monthly',
    0,
    TRUE,
    0,
    0,
    0,
    v_now,
    v_now
  )
  RETURNING * INTO v_tenant;

  -- Flip property occupancy to 'occupied' if it was 'vacant' and we just placed someone.
  IF v_property_id IS NOT NULL AND v_property.occupancy_status = 'vacant' THEN
    UPDATE properties
    SET occupancy_status = 'occupied',
        updated_at = v_now
    WHERE id = v_property_id;
  END IF;

  IF v_email <> '' THEN
    BEGIN
      INSERT INTO profiles (
        email,
        full_name,
        phone,
        role,
        tenant_id,
        created_at,
        updated_at
      ) VALUES (
        v_email,
        v_tenant_name,
        v_contact,
        'tenant',
        v_tenant.id,
        v_now,
        v_now
      );
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  BEGIN
    INSERT INTO activity_logs (
      property_id,
      tenant_id,
      user_id,
      action_type,
      description,
      metadata,
      created_at
    ) VALUES (
      v_log_property_id,
      v_tenant.id,
      v_user_id,
      'tenant_added',
      CASE
        WHEN v_property_id IS NOT NULL
          THEN format('Tenant added to %s: %s', COALESCE(v_property.unit_name, 'property'), v_tenant_name)
        ELSE format('Unhoused tenant added: %s', v_tenant_name)
      END,
      jsonb_build_object(
        'tenant_name', v_tenant_name,
        'contact_number', v_contact,
        'has_email', v_email <> '',
        'unhoused', v_property_id IS NULL,
        'property_id', v_property_id,
        'tenant_slot', v_next_slot
      ),
      v_now
    );
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN jsonb_build_object(
    'tenant', to_jsonb(v_tenant)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_unhoused_tenant_atomic(JSONB) TO authenticated;

COMMIT;
