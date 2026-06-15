-- Drop the legacy denormalized columns now that every code path reads/writes
-- via sibling tenant rows and per-tenant billing rows. The data in these
-- columns has been redundant since normalize_individual_tenants_and_period_id_model.sql
-- ran (pax_details became a single-element self-description; the three
-- billing_entries text-JSON columns became NULL on new rows).
--
-- This migration:
--   1) Reapplies create_property_atomic, create_unhoused_tenant_atomic, and
--      update_property_atomic without touching the legacy columns, so the
--      following ALTER TABLE drops are safe.
--   2) Drops the columns.
--
-- Run order: after add_update_property_atomic_rpc.sql, before
-- zz_canonicalize_atomic_rpc_functions.sql.
--
-- Irreversible: lose the JSON snapshots permanently. For dev DBs this is fine
-- because the data was redundant; for shared/prod environments confirm the
-- post-normalize state first by running:
--   SELECT COUNT(*) FILTER (WHERE pax > 1) AS rows_pax_gt_1,
--          COUNT(*) FILTER (WHERE jsonb_array_length(pax_details) > 1)
--            AS rows_pax_details_gt_1
--   FROM tenants;
-- Both must be 0 before applying.

BEGIN;

-- 1) Reapply RPCs without legacy column writes.

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
  v_people JSONB := '[]'::JSONB;
  v_person JSONB;
  v_tenants JSONB := '[]'::JSONB;
  v_billing_entries JSONB := '[]'::JSONB;
  v_max_tenants INTEGER := COALESCE((payload->>'maxTenants')::INTEGER, 1);
  v_occupancy_status TEXT := COALESCE(payload->>'occupancyStatus', 'vacant');
  v_tenant_ids UUID[] := ARRAY[]::UUID[];
  v_tenant_count INTEGER := 0;
  v_person_idx INTEGER := 0;
  v_due_day TEXT := COALESCE(NULLIF(payload->>'dueDay', ''), '1');
  r_schedule RECORD;
  v_period_id UUID;
  v_entry_status TEXT;
  v_total_rent NUMERIC;
  v_total_other_charges NUMERIC;
  v_rent_due NUMERIC;
  v_other_charges NUMERIC;
  v_current_tenant_id UUID;
  v_current_tenant_index INTEGER;
  v_inserted_entry billing_entries%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  INSERT INTO properties (
    landlord_id, unit_name, property_type, occupancy_status, property_location,
    rent_amount, max_tenants, bed_space_billing_mode, lease_date, notes,
    created_at, updated_at
  ) VALUES (
    v_user_id, payload->>'unitName', payload->>'propertyType', v_occupancy_status,
    payload->>'propertyLocation', COALESCE((payload->>'rentAmount')::NUMERIC, 0),
    v_max_tenants,
    CASE WHEN v_max_tenants > 1 THEN 'per_tenant' ELSE 'unified' END,
    NULLIF(payload->>'leaseDate', '')::DATE, '[]', v_now, v_now
  )
  RETURNING * INTO v_property;

  IF v_occupancy_status = 'occupied' THEN
    IF jsonb_typeof(payload->'tenants') = 'array' THEN
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object(
          'name', COALESCE(elem->>'tenantName', ''),
          'email', COALESCE(elem->>'tenantEmail', ''),
          'phone', COALESCE(elem->>'contactNumber', '')
        )),
        '[]'::JSONB
      )
      INTO v_people
      FROM jsonb_array_elements(payload->'tenants') AS elem
      WHERE btrim(COALESCE(elem->>'tenantName', '')) <> '';
    ELSIF btrim(COALESCE(payload->>'tenantName', '')) <> '' THEN
      v_people := jsonb_build_array(jsonb_build_object(
        'name', payload->>'tenantName',
        'email', COALESCE(payload->>'tenantEmail', ''),
        'phone', COALESCE(payload->>'contactNumber', '')
      ));
    END IF;

    IF jsonb_typeof(v_people) = 'array' THEN
      FOR v_person IN SELECT value FROM jsonb_array_elements(v_people) LOOP
        v_person_idx := v_person_idx + 1;

        INSERT INTO tenants (
          landlord_id, property_id, tenant_name, email, contact_number, tenant_slot,
          contract_months, billing_frequency, rent_per_person, rent_start_date,
          due_day, is_active, advance_payment, security_deposit, overflow,
          created_at, updated_at
        ) VALUES (
          v_user_id, v_property.id,
          COALESCE(NULLIF(v_person->>'name', ''), format('Tenant %s', v_person_idx)),
          COALESCE(v_person->>'email', ''),
          COALESCE(v_person->>'phone', ''),
          v_person_idx,
          COALESCE((payload->>'contractMonths')::INTEGER, 0),
          COALESCE(NULLIF(payload->>'formBasis', ''), 'monthly'),
          COALESCE((payload->>'rentPerCollection')::NUMERIC, 0),
          NULLIF(payload->>'rentStartDate', '')::DATE,
          v_due_day, TRUE,
          COALESCE((payload->>'advancePayment')::NUMERIC, 0),
          COALESCE((payload->>'securityDeposit')::NUMERIC, 0),
          0, v_now, v_now
        )
        RETURNING * INTO v_tenant;

        v_tenants := v_tenants || jsonb_build_array(to_jsonb(v_tenant));
        v_tenant_ids := array_append(v_tenant_ids, v_tenant.id);

        IF btrim(COALESCE(v_person->>'email', '')) <> '' THEN
          BEGIN
            INSERT INTO profiles (
              email, full_name, phone, role, tenant_id, created_at, updated_at
            ) VALUES (
              COALESCE(v_person->>'email', ''),
              COALESCE(NULLIF(v_person->>'name', ''), format('Tenant %s', v_person_idx)),
              COALESCE(v_person->>'phone', ''),
              'tenant', v_tenant.id, v_now, v_now
            );
          EXCEPTION WHEN OTHERS THEN NULL; END;
        END IF;
      END LOOP;
    END IF;

    v_tenant_count := COALESCE(array_length(v_tenant_ids, 1), 0);

    IF v_tenant_count > 0
      AND jsonb_typeof(payload->'billingSchedule') = 'array'
      AND jsonb_array_length(payload->'billingSchedule') > 0
    THEN
      FOR r_schedule IN
        SELECT elem, ordinality::INTEGER
        FROM jsonb_array_elements(payload->'billingSchedule') WITH ORDINALITY AS t(elem, ordinality)
      LOOP
        v_period_id := gen_random_uuid();
        v_total_rent := COALESCE((r_schedule.elem->>'rentDue')::NUMERIC, 0);
        v_total_other_charges := COALESCE((r_schedule.elem->>'otherCharges')::NUMERIC, 0);

        FOR v_current_tenant_index IN 1..v_tenant_count LOOP
          v_current_tenant_id := v_tenant_ids[v_current_tenant_index];

          v_rent_due := COALESCE(
            NULLIF((r_schedule.elem->'tenantRentAmounts'->>(v_current_tenant_index - 1)::TEXT), '')::NUMERIC,
            (payload->>'rentPerCollection')::NUMERIC,
            v_total_rent
          );
          v_other_charges := COALESCE(
            NULLIF((r_schedule.elem->'tenantOtherCharges'->>(v_current_tenant_index - 1)::TEXT), '')::NUMERIC,
            v_total_other_charges
          );

          v_entry_status := CASE
            WHEN (COALESCE(v_rent_due, 0) + COALESCE(v_other_charges, 0)) <= 0 THEN 'Not Yet Set'
            ELSE COALESCE(r_schedule.elem->>'status', 'Not Yet Due')
          END;

          INSERT INTO billing_entries (
            property_id, tenant_id, due_date, rent_due, other_charges, gross_due,
            status, expense_items, billing_period, period_id, paid_amount,
            created_at, updated_at
          ) VALUES (
            v_property.id, v_current_tenant_id,
            (r_schedule.elem->>'dueDate')::DATE,
            COALESCE(v_rent_due, 0),
            COALESCE(v_other_charges, 0),
            COALESCE(v_rent_due, 0) + COALESCE(v_other_charges, 0),
            v_entry_status,
            COALESCE(r_schedule.elem->'expenseItems', '[]'::JSONB),
            r_schedule.ordinality, v_period_id, 0, v_now, v_now
          )
          RETURNING * INTO v_inserted_entry;

          v_billing_entries := v_billing_entries || jsonb_build_array(to_jsonb(v_inserted_entry));
        END LOOP;
      END LOOP;
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
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;
  IF v_tenant_name = '' THEN RAISE EXCEPTION 'Tenant name is required'; END IF;
  IF v_contact = '' THEN RAISE EXCEPTION 'Contact number is required'; END IF;

  IF v_property_id IS NOT NULL THEN
    SELECT * INTO v_property
    FROM properties
    WHERE id = v_property_id AND landlord_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Property not found or not owned by current user'; END IF;

    v_max_tenants := COALESCE(v_property.max_tenants, 1);

    SELECT COUNT(*) INTO v_active_tenant_count
    FROM tenants WHERE property_id = v_property_id AND is_active = TRUE;

    IF v_active_tenant_count >= v_max_tenants THEN
      RAISE EXCEPTION 'Property is fully occupied (% of % slots filled)', v_active_tenant_count, v_max_tenants;
    END IF;

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

CREATE OR REPLACE FUNCTION public.update_property_atomic(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_property_id UUID := NULLIF(payload->>'propertyId', '')::UUID;
  v_property properties%ROWTYPE;
  v_property_meta JSONB := COALESCE(payload->'property', '{}'::JSONB);
  v_occupants JSONB := COALESCE(payload->'occupants', '[]'::JSONB);
  v_removed JSONB := COALESCE(payload->'removedTenantIds', '[]'::JSONB);
  v_lease JSONB := COALESCE(payload->'lease', '{}'::JSONB);
  v_occupant JSONB;
  v_removed_id_text TEXT;
  v_existing_id UUID;
  v_max_existing_slot INTEGER;
  v_active_count INTEGER;
  v_returned_tenants JSONB := '[]'::JSONB;
  v_tenant tenants%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;
  IF v_property_id IS NULL THEN RAISE EXCEPTION 'propertyId is required'; END IF;

  SELECT * INTO v_property FROM properties
  WHERE id = v_property_id AND landlord_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Property not found'; END IF;

  UPDATE properties
  SET
    unit_name = COALESCE(NULLIF(v_property_meta->>'unit_name', ''), unit_name),
    property_type = COALESCE(NULLIF(v_property_meta->>'property_type', ''), property_type),
    property_location = COALESCE(NULLIF(v_property_meta->>'property_location', ''), property_location),
    rent_amount = COALESCE((v_property_meta->>'rent_amount')::NUMERIC, rent_amount),
    max_tenants = COALESCE((v_property_meta->>'max_tenants')::INTEGER, max_tenants),
    lease_date = CASE WHEN v_property_meta ? 'lease_date'
      THEN NULLIF(v_property_meta->>'lease_date', '')::DATE ELSE lease_date END,
    notes = COALESCE(v_property_meta->>'notes', notes),
    updated_at = v_now
  WHERE id = v_property_id;

  IF jsonb_typeof(v_removed) = 'array' THEN
    FOR v_removed_id_text IN SELECT jsonb_array_elements_text(v_removed) LOOP
      IF v_removed_id_text IS NOT NULL AND v_removed_id_text <> '' THEN
        UPDATE tenants SET is_active = FALSE, updated_at = v_now
        WHERE id = v_removed_id_text::UUID
          AND property_id = v_property_id
          AND landlord_id = v_user_id;
      END IF;
    END LOOP;
  END IF;

  SELECT COALESCE(MAX(tenant_slot), 0) INTO v_max_existing_slot
  FROM tenants WHERE property_id = v_property_id;

  IF jsonb_typeof(v_occupants) = 'array' THEN
    FOR v_occupant IN SELECT value FROM jsonb_array_elements(v_occupants) LOOP
      v_existing_id := NULLIF(v_occupant->>'id', '')::UUID;

      IF v_existing_id IS NOT NULL THEN
        UPDATE tenants
        SET tenant_name = COALESCE(NULLIF(v_occupant->>'name', ''), tenant_name),
            email = COALESCE(v_occupant->>'email', email),
            contact_number = COALESCE(NULLIF(v_occupant->>'phone', ''), contact_number),
            is_active = TRUE,
            updated_at = v_now
        WHERE id = v_existing_id
          AND property_id = v_property_id
          AND landlord_id = v_user_id
        RETURNING * INTO v_tenant;
      ELSE
        IF btrim(COALESCE(v_occupant->>'name', '')) = '' THEN CONTINUE; END IF;

        v_max_existing_slot := v_max_existing_slot + 1;

        INSERT INTO tenants (
          landlord_id, property_id, tenant_name, email, contact_number, tenant_slot,
          contract_months, rent_start_date, due_day, billing_frequency, rent_per_person,
          is_active, advance_payment, security_deposit, overflow, created_at, updated_at
        ) VALUES (
          v_user_id, v_property_id,
          v_occupant->>'name',
          COALESCE(v_occupant->>'email', ''),
          COALESCE(v_occupant->>'phone', ''),
          v_max_existing_slot,
          NULLIF(v_lease->>'contract_months', '')::INTEGER,
          NULLIF(v_lease->>'rent_start_date', '')::DATE,
          NULLIF(v_lease->>'due_day', ''),
          COALESCE(NULLIF(v_lease->>'billing_frequency', ''), 'monthly'),
          COALESCE((v_lease->>'rent_per_person')::NUMERIC, 0),
          TRUE, 0, 0, 0, v_now, v_now
        )
        RETURNING * INTO v_tenant;

        IF btrim(COALESCE(v_occupant->>'email', '')) <> '' THEN
          BEGIN
            INSERT INTO profiles (
              email, full_name, phone, role, tenant_id, created_at, updated_at
            ) VALUES (
              v_occupant->>'email', v_occupant->>'name',
              COALESCE(v_occupant->>'phone', ''), 'tenant',
              v_tenant.id, v_now, v_now
            );
          EXCEPTION WHEN OTHERS THEN NULL; END;
        END IF;
      END IF;
    END LOOP;
  END IF;

  UPDATE tenants
  SET
    contract_months = CASE WHEN v_lease ? 'contract_months'
      THEN NULLIF(v_lease->>'contract_months', '')::INTEGER ELSE contract_months END,
    rent_start_date = CASE WHEN v_lease ? 'rent_start_date'
      THEN NULLIF(v_lease->>'rent_start_date', '')::DATE ELSE rent_start_date END,
    due_day = CASE WHEN v_lease ? 'due_day'
      THEN NULLIF(v_lease->>'due_day', '') ELSE due_day END,
    billing_frequency = CASE WHEN v_lease ? 'billing_frequency'
      THEN COALESCE(NULLIF(v_lease->>'billing_frequency', ''), 'monthly') ELSE billing_frequency END,
    rent_per_person = CASE WHEN v_lease ? 'rent_per_person'
      THEN COALESCE((v_lease->>'rent_per_person')::NUMERIC, rent_per_person) ELSE rent_per_person END,
    updated_at = v_now
  WHERE property_id = v_property_id
    AND landlord_id = v_user_id
    AND is_active = TRUE;

  SELECT COUNT(*) INTO v_active_count FROM tenants
  WHERE property_id = v_property_id AND is_active = TRUE;

  UPDATE properties
  SET occupancy_status = CASE WHEN v_active_count > 0 THEN 'occupied' ELSE 'vacant' END,
      updated_at = v_now
  WHERE id = v_property_id;

  SELECT * INTO v_property FROM properties WHERE id = v_property_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.tenant_slot), '[]'::JSONB)
  INTO v_returned_tenants
  FROM tenants t
  WHERE t.property_id = v_property_id AND t.landlord_id = v_user_id;

  RETURN jsonb_build_object(
    'property', to_jsonb(v_property),
    'tenants', v_returned_tenants
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_property_atomic(JSONB) TO authenticated;

-- 2) Drop the legacy columns now that no RPC writes them.

ALTER TABLE public.tenants DROP COLUMN IF EXISTS pax_details;
ALTER TABLE public.tenants DROP COLUMN IF EXISTS pax;

ALTER TABLE public.billing_entries DROP COLUMN IF EXISTS tenant_payments;
ALTER TABLE public.billing_entries DROP COLUMN IF EXISTS tenant_rent_amounts;
ALTER TABLE public.billing_entries DROP COLUMN IF EXISTS tenant_other_charges;

COMMIT;
