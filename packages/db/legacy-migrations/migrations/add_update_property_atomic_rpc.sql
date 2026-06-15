-- update_property_atomic — atomic upsert of property metadata, occupant tenant
-- rows, and shared lease fields. Mirrors create_property_atomic for the edit
-- path. Does NOT touch billing_entries; billing edits are handled separately
-- (edit-billing-popup, plus a future fan-out follow-up for property-level
-- schedule changes).
--
-- Run order: after add_landlord_id_to_tenants_and_unhoused_support.sql and
-- extend_create_tenant_with_optional_property_assignment.sql, before
-- zz_canonicalize_atomic_rpc_functions.sql.
--
-- Payload shape:
-- {
--   propertyId: uuid,
--   property: {
--     unit_name?, property_type?, property_location?, rent_amount?,
--     max_tenants?, lease_date?, notes?
--   },
--   occupants: [
--     { id?: uuid, name: string, email?: string, phone: string }
--   ],
--   removedTenantIds: [uuid, ...],
--   lease: {
--     contract_months?: int,
--     rent_start_date?: date,
--     due_day?: text,
--     billing_frequency?: text,
--     rent_per_person?: numeric
--   }
-- }
--
-- Returns: { property, tenants }
--
-- Notes:
-- - Insertions get the next free tenant_slot.
-- - Removed tenants are soft-deleted (is_active = false) so billing history is
--   preserved. Use the archive flow for hard delete.
-- - occupancy_status is recomputed: 'occupied' if any active tenant remains,
--   else 'vacant'.
-- - lease fields are written to every active tenant on the property so the
--   property has a single coherent lease (matches the existing UX).

BEGIN;

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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF v_property_id IS NULL THEN
    RAISE EXCEPTION 'propertyId is required';
  END IF;

  -- Lock and validate ownership.
  SELECT *
  INTO v_property
  FROM properties
  WHERE id = v_property_id
    AND landlord_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  -- Update property metadata. Only fields present in payload->property are touched.
  UPDATE properties
  SET
    unit_name = COALESCE(NULLIF(v_property_meta->>'unit_name', ''), unit_name),
    property_type = COALESCE(NULLIF(v_property_meta->>'property_type', ''), property_type),
    property_location = COALESCE(NULLIF(v_property_meta->>'property_location', ''), property_location),
    rent_amount = COALESCE((v_property_meta->>'rent_amount')::NUMERIC, rent_amount),
    max_tenants = COALESCE((v_property_meta->>'max_tenants')::INTEGER, max_tenants),
    lease_date = CASE
      WHEN v_property_meta ? 'lease_date'
        THEN NULLIF(v_property_meta->>'lease_date', '')::DATE
      ELSE lease_date
    END,
    notes = COALESCE(v_property_meta->>'notes', notes),
    updated_at = v_now
  WHERE id = v_property_id;

  -- Soft-delete removed tenants (only those owned by this landlord and on this property).
  IF jsonb_typeof(v_removed) = 'array' THEN
    FOR v_removed_id_text IN SELECT jsonb_array_elements_text(v_removed) LOOP
      IF v_removed_id_text IS NOT NULL AND v_removed_id_text <> '' THEN
        UPDATE tenants
        SET is_active = FALSE,
            updated_at = v_now
        WHERE id = v_removed_id_text::UUID
          AND property_id = v_property_id
          AND landlord_id = v_user_id;
      END IF;
    END LOOP;
  END IF;

  -- Highest tenant_slot in use on this property; new occupants slot in after.
  SELECT COALESCE(MAX(tenant_slot), 0)
  INTO v_max_existing_slot
  FROM tenants
  WHERE property_id = v_property_id;

  -- Upsert occupants.
  IF jsonb_typeof(v_occupants) = 'array' THEN
    FOR v_occupant IN SELECT value FROM jsonb_array_elements(v_occupants) LOOP
      v_existing_id := NULLIF(v_occupant->>'id', '')::UUID;

      IF v_existing_id IS NOT NULL THEN
        -- UPDATE existing tenant. RLS already gates by landlord_id; the property
        -- match guards against cross-property mistakes.
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

        IF FOUND THEN
          v_returned_tenants := v_returned_tenants || jsonb_build_array(to_jsonb(v_tenant));
        END IF;
      ELSE
        -- INSERT new occupant. Skip blank rows (no name).
        IF btrim(COALESCE(v_occupant->>'name', '')) = '' THEN
          CONTINUE;
        END IF;

        v_max_existing_slot := v_max_existing_slot + 1;

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
          v_occupant->>'name',
          COALESCE(v_occupant->>'email', ''),
          COALESCE(v_occupant->>'phone', ''),
          v_max_existing_slot,
          1,
          jsonb_build_array(
            jsonb_build_object(
              'name', v_occupant->>'name',
              'email', COALESCE(v_occupant->>'email', ''),
              'phone', COALESCE(v_occupant->>'phone', '')
            )
          ),
          NULLIF(v_lease->>'contract_months', '')::INTEGER,
          NULLIF(v_lease->>'rent_start_date', '')::DATE,
          NULLIF(v_lease->>'due_day', ''),
          COALESCE(NULLIF(v_lease->>'billing_frequency', ''), 'monthly'),
          COALESCE((v_lease->>'rent_per_person')::NUMERIC, 0),
          TRUE,
          0,
          0,
          0,
          v_now,
          v_now
        )
        RETURNING * INTO v_tenant;

        v_returned_tenants := v_returned_tenants || jsonb_build_array(to_jsonb(v_tenant));

        IF btrim(COALESCE(v_occupant->>'email', '')) <> '' THEN
          BEGIN
            INSERT INTO profiles (
              email, full_name, phone, role, tenant_id, created_at, updated_at
            ) VALUES (
              v_occupant->>'email',
              v_occupant->>'name',
              COALESCE(v_occupant->>'phone', ''),
              'tenant',
              v_tenant.id,
              v_now,
              v_now
            );
          EXCEPTION WHEN OTHERS THEN NULL; END;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Propagate lease fields to every active tenant on the property. Only fields
  -- explicitly present in payload->lease are touched (so a partial save doesn't
  -- nuke unrelated lease state).
  UPDATE tenants
  SET
    contract_months = CASE
      WHEN v_lease ? 'contract_months'
        THEN NULLIF(v_lease->>'contract_months', '')::INTEGER
      ELSE contract_months
    END,
    rent_start_date = CASE
      WHEN v_lease ? 'rent_start_date'
        THEN NULLIF(v_lease->>'rent_start_date', '')::DATE
      ELSE rent_start_date
    END,
    due_day = CASE
      WHEN v_lease ? 'due_day'
        THEN NULLIF(v_lease->>'due_day', '')
      ELSE due_day
    END,
    billing_frequency = CASE
      WHEN v_lease ? 'billing_frequency'
        THEN COALESCE(NULLIF(v_lease->>'billing_frequency', ''), 'monthly')
      ELSE billing_frequency
    END,
    rent_per_person = CASE
      WHEN v_lease ? 'rent_per_person'
        THEN COALESCE((v_lease->>'rent_per_person')::NUMERIC, rent_per_person)
      ELSE rent_per_person
    END,
    updated_at = v_now
  WHERE property_id = v_property_id
    AND landlord_id = v_user_id
    AND is_active = TRUE;

  -- Recompute occupancy_status based on active tenant count.
  SELECT COUNT(*)
  INTO v_active_count
  FROM tenants
  WHERE property_id = v_property_id
    AND is_active = TRUE;

  UPDATE properties
  SET occupancy_status = CASE WHEN v_active_count > 0 THEN 'occupied' ELSE 'vacant' END,
      updated_at = v_now
  WHERE id = v_property_id;

  -- Re-read for the returned payload.
  SELECT * INTO v_property FROM properties WHERE id = v_property_id;

  -- Build the full active-tenant list for the response (anything we touched
  -- plus untouched siblings).
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.tenant_slot), '[]'::JSONB)
  INTO v_returned_tenants
  FROM tenants t
  WHERE t.property_id = v_property_id
    AND t.landlord_id = v_user_id;

  RETURN jsonb_build_object(
    'property', to_jsonb(v_property),
    'tenants', v_returned_tenants
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_property_atomic(JSONB) TO authenticated;

COMMIT;
