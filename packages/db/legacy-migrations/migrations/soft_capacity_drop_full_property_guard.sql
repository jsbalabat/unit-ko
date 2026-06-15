-- Switch property capacity to a soft model. max_tenants becomes record-keeping
-- only; assignments past the cap are allowed and the UI shows an over-capacity
-- remark. The hard "Property is fully occupied" guard inside
-- create_unhoused_tenant_atomic is removed. Ownership and slot-allocation
-- behavior is unchanged.
--
-- Run order: any time after extend_create_tenant_with_optional_property_assignment.sql,
-- before zz_canonicalize_atomic_rpc_functions.sql. Idempotent.

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
  v_next_slot INTEGER := 1;
  v_max_existing_slot INTEGER;
  v_log_property_id UUID := NULL;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;
  IF v_tenant_name = '' THEN RAISE EXCEPTION 'Tenant name is required'; END IF;
  IF v_contact = '' THEN RAISE EXCEPTION 'Contact number is required'; END IF;

  IF v_property_id IS NOT NULL THEN
    SELECT * INTO v_property
    FROM properties
    WHERE id = v_property_id AND landlord_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Property not found or not owned by current user'; END IF;

    -- Soft capacity: max_tenants is informational. Allow inserts past the cap;
    -- the UI surfaces an over-capacity remark.

    SELECT COALESCE(MAX(tenant_slot), 0) INTO v_max_existing_slot
    FROM tenants WHERE property_id = v_property_id;

    v_next_slot := COALESCE(v_max_existing_slot, 0) + 1;
    v_log_property_id := v_property_id;
  END IF;

  INSERT INTO tenants (
    landlord_id, property_id, tenant_name, email, contact_number, tenant_slot,
    contract_months, rent_start_date, due_day, billing_frequency, rent_per_person,
    is_active, advance_payment, security_deposit, overflow, created_at, updated_at
  ) VALUES (
    v_user_id, v_property_id, v_tenant_name, v_email, v_contact, v_next_slot,
    NULL, NULL, NULL, 'monthly', 0, TRUE, 0, 0, 0, v_now, v_now
  )
  RETURNING * INTO v_tenant;

  IF v_property_id IS NOT NULL AND v_property.occupancy_status = 'vacant' THEN
    UPDATE properties SET occupancy_status = 'occupied', updated_at = v_now
    WHERE id = v_property_id;
  END IF;

  IF v_email <> '' THEN
    BEGIN
      INSERT INTO profiles (
        email, full_name, phone, role, tenant_id, created_at, updated_at
      ) VALUES (
        v_email, v_tenant_name, v_contact, 'tenant', v_tenant.id, v_now, v_now
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  BEGIN
    INSERT INTO activity_logs (
      property_id, tenant_id, user_id, action_type, description, metadata, created_at
    ) VALUES (
      v_log_property_id, v_tenant.id, v_user_id, 'tenant_added',
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
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('tenant', to_jsonb(v_tenant));
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_unhoused_tenant_atomic(JSONB) TO authenticated;

COMMIT;
