-- Atomic property creation RPC to prevent partial writes across
-- property, tenant, profile, and billing_entries tables.

CREATE OR REPLACE FUNCTION public.create_property_atomic(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_property properties%ROWTYPE;
  v_tenant tenants%ROWTYPE;
  v_pax_details JSONB := '[]'::JSONB;
  v_tenants JSONB := '[]'::JSONB;
  v_billing_entries JSONB := '[]'::JSONB;
  v_max_tenants INTEGER := COALESCE((payload->>'maxTenants')::INTEGER, 1);
  v_occupancy_status TEXT := COALESCE(payload->>'occupancyStatus', 'vacant');
  v_pax_count INTEGER := 0;
  v_first_tenant_name TEXT;
  v_first_tenant_email TEXT;
  v_first_tenant_phone TEXT;
  v_zero_rent_amounts TEXT;
  v_zero_charge_amounts TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  INSERT INTO properties (
    landlord_id,
    unit_name,
    property_type,
    occupancy_status,
    property_location,
    rent_amount,
    max_tenants,
    bed_space_billing_mode,
    lease_date,
    notes,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    payload->>'unitName',
    payload->>'propertyType',
    v_occupancy_status,
    payload->>'propertyLocation',
    COALESCE((payload->>'rentAmount')::NUMERIC, 0),
    v_max_tenants,
    CASE WHEN v_max_tenants > 1 THEN 'per_tenant' ELSE 'unified' END,
    NULLIF(payload->>'leaseDate', '')::DATE,
    '[]',
    v_now,
    v_now
  )
  RETURNING * INTO v_property;

  IF v_occupancy_status = 'occupied' THEN
    IF v_max_tenants > 1 AND jsonb_typeof(payload->'tenants') = 'array' THEN
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'name', elem->>'tenantName',
            'email', COALESCE(elem->>'tenantEmail', ''),
            'phone', COALESCE(elem->>'contactNumber', '')
          )
        ),
        '[]'::JSONB
      )
      INTO v_pax_details
      FROM jsonb_array_elements(payload->'tenants') AS elem
      WHERE btrim(COALESCE(elem->>'tenantName', '')) <> '';
    ELSIF btrim(COALESCE(payload->>'tenantName', '')) <> '' THEN
      v_pax_details := jsonb_build_array(
        jsonb_build_object(
          'name', payload->>'tenantName',
          'email', COALESCE(payload->>'tenantEmail', ''),
          'phone', COALESCE(payload->>'contactNumber', '')
        )
      );
    END IF;

    v_pax_count := COALESCE(jsonb_array_length(v_pax_details), 0);

    IF v_pax_count > 0 THEN
      v_first_tenant_name := v_pax_details->0->>'name';
      v_first_tenant_email := COALESCE(v_pax_details->0->>'email', '');
      v_first_tenant_phone := COALESCE(v_pax_details->0->>'phone', '');

      INSERT INTO tenants (
        property_id,
        tenant_name,
        email,
        contact_number,
        pax,
        pax_details,
        contract_months,
        billing_frequency,
        rent_per_person,
        rent_start_date,
        due_day,
        is_active,
        advance_payment,
        security_deposit,
        created_at,
        updated_at
      ) VALUES (
        v_property.id,
        v_first_tenant_name,
        v_first_tenant_email,
        v_first_tenant_phone,
        v_pax_count,
        v_pax_details,
        COALESCE((payload->>'contractMonths')::INTEGER, 0),
        COALESCE(NULLIF(payload->>'formBasis', ''), 'monthly'),
        COALESCE((payload->>'rentPerCollection')::NUMERIC, 0),
        NULLIF(payload->>'rentStartDate', '')::DATE,
        payload->>'dueDay',
        TRUE,
        COALESCE((payload->>'advancePayment')::NUMERIC, 0),
        COALESCE((payload->>'securityDeposit')::NUMERIC, 0),
        v_now,
        v_now
      )
      RETURNING * INTO v_tenant;

      v_tenants := jsonb_build_array(to_jsonb(v_tenant));

      IF btrim(v_first_tenant_email) <> '' THEN
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
            v_first_tenant_email,
            v_first_tenant_name,
            v_first_tenant_phone,
            'tenant',
            v_tenant.id,
            v_now,
            v_now
          );
        EXCEPTION
          WHEN OTHERS THEN
            -- Preserve legacy behavior where profile write is best-effort.
            NULL;
        END;
      END IF;

      IF jsonb_typeof(payload->'billingSchedule') = 'array' AND jsonb_array_length(payload->'billingSchedule') > 0 THEN
        IF v_pax_count > 1 THEN
          SELECT ('{' || string_agg(format('"%s":0', i::TEXT), ',') || '}')
          INTO v_zero_rent_amounts
          FROM generate_series(0, v_pax_count - 1) AS i;

          SELECT ('{' || string_agg(format('"%s":0', i::TEXT), ',') || '}')
          INTO v_zero_charge_amounts
          FROM generate_series(0, v_pax_count - 1) AS i;
        END IF;

        WITH inserted AS (
          INSERT INTO billing_entries (
            property_id,
            tenant_id,
            due_date,
            rent_due,
            other_charges,
            gross_due,
            status,
            expense_items,
            billing_period,
            tenant_rent_amounts,
            tenant_other_charges,
            created_at,
            updated_at
          )
          SELECT
            v_property.id,
            v_tenant.id,
            (elem->>'dueDate')::DATE,
            COALESCE((elem->>'rentDue')::NUMERIC, 0),
            COALESCE((elem->>'otherCharges')::NUMERIC, 0),
            COALESCE((elem->>'grossDue')::NUMERIC, 0),
            CASE
              WHEN v_pax_count > 1 AND COALESCE((elem->>'grossDue')::NUMERIC, 0) = 0 THEN 'Not Yet Set'
              WHEN v_pax_count > 1 THEN 'Not Yet Due'
              ELSE COALESCE(elem->>'status', 'Not Yet Due')
            END,
            COALESCE(elem->'expenseItems', '[]'::JSONB),
            ordinality::INTEGER,
            CASE WHEN v_pax_count > 1 THEN v_zero_rent_amounts ELSE NULL END,
            CASE WHEN v_pax_count > 1 THEN v_zero_charge_amounts ELSE NULL END,
            v_now,
            v_now
          FROM jsonb_array_elements(payload->'billingSchedule') WITH ORDINALITY AS t(elem, ordinality)
          RETURNING *
        )
        SELECT COALESCE(jsonb_agg(to_jsonb(inserted)), '[]'::JSONB)
        INTO v_billing_entries
        FROM inserted;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'property', to_jsonb(v_property),
    'tenants', v_tenants,
    'billingEntries', v_billing_entries
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_property_atomic(JSONB) TO authenticated;
