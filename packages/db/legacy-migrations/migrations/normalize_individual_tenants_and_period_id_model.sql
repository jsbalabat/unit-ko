-- Normalize tenancy model to one-row-per-individual-tenant and add period_id for billing grouping.
-- This migration:
-- 1) Adds billing_entries.period_id and uniqueness per property+tenant+period.
-- 2) Splits legacy grouped tenants (pax_details) into individual tenant rows.
-- 3) Rewrites create_property_atomic to create individual tenants and per-tenant billing rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE billing_entries
ADD COLUMN IF NOT EXISTS period_id UUID;

UPDATE billing_entries
SET period_id = gen_random_uuid()
WHERE period_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_billing_entries_period_id
ON billing_entries(period_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_entries_property_tenant_period
ON billing_entries(property_id, tenant_id, period_id);

COMMENT ON COLUMN billing_entries.period_id IS
'Logical billing period identifier shared by multiple tenant rows in the same period for a property.';

DO $$
DECLARE
  r_tenant RECORD;
  v_person JSONB;
  v_new_tenant_id UUID;
  v_old_pax INTEGER;
  i INTEGER;
BEGIN
  CREATE TEMP TABLE tmp_tenant_split_map (
    old_tenant_id UUID NOT NULL,
    person_index INTEGER NOT NULL,
    tenant_id UUID NOT NULL,
    pax_count INTEGER NOT NULL,
    PRIMARY KEY (old_tenant_id, person_index)
  ) ON COMMIT DROP;

  FOR r_tenant IN
    SELECT t.*
    FROM tenants t
    WHERE COALESCE(t.pax, 1) > 1
      AND jsonb_typeof(t.pax_details) = 'array'
      AND jsonb_array_length(t.pax_details) > 1
  LOOP
    v_old_pax := GREATEST(COALESCE(r_tenant.pax, 1), jsonb_array_length(r_tenant.pax_details));

    v_person := COALESCE(r_tenant.pax_details->0, '{}'::JSONB);

    UPDATE tenants
    SET
      tenant_name = COALESCE(NULLIF(v_person->>'name', ''), tenant_name),
      email = COALESCE(NULLIF(v_person->>'email', ''), email),
      contact_number = COALESCE(NULLIF(v_person->>'phone', ''), contact_number),
      pax = 1,
      pax_details = jsonb_build_array(
        jsonb_build_object(
          'name', COALESCE(NULLIF(v_person->>'name', ''), tenant_name),
          'email', COALESCE(NULLIF(v_person->>'email', ''), email),
          'phone', COALESCE(NULLIF(v_person->>'phone', ''), contact_number)
        )
      ),
      tenant_slot = GREATEST(COALESCE(tenant_slot, 1), 1),
      updated_at = NOW()
    WHERE id = r_tenant.id;

    INSERT INTO tmp_tenant_split_map (old_tenant_id, person_index, tenant_id, pax_count)
    VALUES (r_tenant.id, 0, r_tenant.id, v_old_pax);

    FOR i IN 1..(v_old_pax - 1) LOOP
      v_person := COALESCE(r_tenant.pax_details->i, '{}'::JSONB);

      INSERT INTO tenants (
        property_id,
        tenant_name,
        email,
        contact_number,
        tenant_slot,
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
        overflow,
        created_at,
        updated_at
      ) VALUES (
        r_tenant.property_id,
        COALESCE(NULLIF(v_person->>'name', ''), format('%s #%s', r_tenant.tenant_name, i + 1)),
        COALESCE(NULLIF(v_person->>'email', ''), r_tenant.email),
        COALESCE(NULLIF(v_person->>'phone', ''), r_tenant.contact_number),
        GREATEST(COALESCE(r_tenant.tenant_slot, 1) + i, 1),
        1,
        jsonb_build_array(
          jsonb_build_object(
            'name', COALESCE(NULLIF(v_person->>'name', ''), format('%s #%s', r_tenant.tenant_name, i + 1)),
            'email', COALESCE(NULLIF(v_person->>'email', ''), r_tenant.email),
            'phone', COALESCE(NULLIF(v_person->>'phone', ''), r_tenant.contact_number)
          )
        ),
        r_tenant.contract_months,
        r_tenant.billing_frequency,
        r_tenant.rent_per_person,
        r_tenant.rent_start_date,
        r_tenant.due_day,
        r_tenant.is_active,
        COALESCE(r_tenant.advance_payment, 0),
        COALESCE(r_tenant.security_deposit, 0),
        COALESCE(r_tenant.overflow, 0),
        NOW(),
        NOW()
      )
      RETURNING id INTO v_new_tenant_id;

      INSERT INTO tmp_tenant_split_map (old_tenant_id, person_index, tenant_id, pax_count)
      VALUES (r_tenant.id, i, v_new_tenant_id, v_old_pax);
    END LOOP;
  END LOOP;

  IF EXISTS (SELECT 1 FROM tmp_tenant_split_map WHERE person_index > 0) THEN
    CREATE TEMP TABLE tmp_split_entries ON COMMIT DROP AS
    WITH source_entries AS (
      SELECT
        be.*,
        COALESCE(be.period_id, gen_random_uuid()) AS normalized_period_id
      FROM billing_entries be
      WHERE EXISTS (
        SELECT 1
        FROM tmp_tenant_split_map m
        WHERE m.old_tenant_id = be.tenant_id
      )
    )
    SELECT
      gen_random_uuid() AS id,
      se.property_id,
      m.tenant_id,
      se.due_date,
      COALESCE(
        CASE
          WHEN se.tenant_rent_amounts IS NOT NULL AND btrim(se.tenant_rent_amounts) <> ''
            THEN NULLIF((se.tenant_rent_amounts::JSONB ->> m.person_index::TEXT), '')::NUMERIC
          ELSE NULL
        END,
        CASE
          WHEN m.pax_count > 1 THEN ROUND((COALESCE(se.rent_due, 0)::NUMERIC) / m.pax_count::NUMERIC, 2)
          ELSE COALESCE(se.rent_due, 0)::NUMERIC
        END
      ) AS rent_due,
      COALESCE(
        CASE
          WHEN se.tenant_other_charges IS NOT NULL AND btrim(se.tenant_other_charges) <> ''
            THEN NULLIF((se.tenant_other_charges::JSONB ->> m.person_index::TEXT), '')::NUMERIC
          ELSE NULL
        END,
        CASE
          WHEN m.pax_count > 1 THEN ROUND((COALESCE(se.other_charges, 0)::NUMERIC) / m.pax_count::NUMERIC, 2)
          ELSE COALESCE(se.other_charges, 0)::NUMERIC
        END
      ) AS other_charges,
      0::NUMERIC AS gross_due,
      se.status,
      se.expense_items,
      se.billing_period,
      se.normalized_period_id AS period_id,
      COALESCE(
        CASE
          WHEN se.tenant_payments IS NOT NULL AND btrim(se.tenant_payments) <> ''
            THEN NULLIF((se.tenant_payments::JSONB ->> m.person_index::TEXT), '')::NUMERIC
          ELSE NULL
        END,
        CASE
          WHEN m.pax_count > 1 THEN ROUND((COALESCE(se.paid_amount, 0)::NUMERIC) / m.pax_count::NUMERIC, 2)
          ELSE COALESCE(se.paid_amount, 0)::NUMERIC
        END
      ) AS paid_amount,
      se.created_at,
      NOW() AS updated_at
    FROM source_entries se
    JOIN tmp_tenant_split_map m
      ON m.old_tenant_id = se.tenant_id;

    UPDATE tmp_split_entries
    SET gross_due = COALESCE(rent_due, 0) + COALESCE(other_charges, 0);

    UPDATE tmp_split_entries
    SET status = CASE
      WHEN gross_due <= 0.01 THEN 'Not Yet Set'
      WHEN COALESCE(paid_amount, 0) >= gross_due - 0.01 THEN 'Paid'
      WHEN COALESCE(paid_amount, 0) > 0.01 THEN 'Partial'
      WHEN due_date < CURRENT_DATE THEN 'Overdue'
      ELSE 'Not Yet Due'
    END;

    DELETE FROM billing_entries be
    WHERE EXISTS (
      SELECT 1
      FROM tmp_tenant_split_map m
      WHERE m.old_tenant_id = be.tenant_id
    );

    INSERT INTO billing_entries (
      id,
      property_id,
      tenant_id,
      due_date,
      rent_due,
      other_charges,
      gross_due,
      status,
      expense_items,
      billing_period,
      period_id,
      paid_amount,
      tenant_rent_amounts,
      tenant_other_charges,
      tenant_payments,
      created_at,
      updated_at
    )
    SELECT
      id,
      property_id,
      tenant_id,
      due_date,
      rent_due,
      other_charges,
      gross_due,
      status,
      expense_items,
      billing_period,
      period_id,
      paid_amount,
      NULL,
      NULL,
      NULL,
      created_at,
      updated_at
    FROM tmp_split_entries;
  END IF;
END $$;

-- Rebuild atomic property creation to insert one tenant row per person and one billing row per tenant per period.
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
    IF jsonb_typeof(payload->'tenants') = 'array' THEN
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'name', COALESCE(elem->>'tenantName', ''),
            'email', COALESCE(elem->>'tenantEmail', ''),
            'phone', COALESCE(elem->>'contactNumber', '')
          )
        ),
        '[]'::JSONB
      )
      INTO v_people
      FROM jsonb_array_elements(payload->'tenants') AS elem
      WHERE btrim(COALESCE(elem->>'tenantName', '')) <> '';
    ELSIF btrim(COALESCE(payload->>'tenantName', '')) <> '' THEN
      v_people := jsonb_build_array(
        jsonb_build_object(
          'name', payload->>'tenantName',
          'email', COALESCE(payload->>'tenantEmail', ''),
          'phone', COALESCE(payload->>'contactNumber', '')
        )
      );
    END IF;

    IF jsonb_typeof(v_people) = 'array' THEN
      FOR v_person IN SELECT value FROM jsonb_array_elements(v_people)
      LOOP
        v_person_idx := v_person_idx + 1;

        INSERT INTO tenants (
          property_id,
          tenant_name,
          email,
          contact_number,
          tenant_slot,
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
          overflow,
          created_at,
          updated_at
        ) VALUES (
          v_property.id,
          COALESCE(NULLIF(v_person->>'name', ''), format('Tenant %s', v_person_idx)),
          COALESCE(v_person->>'email', ''),
          COALESCE(v_person->>'phone', ''),
          v_person_idx,
          1,
          jsonb_build_array(
            jsonb_build_object(
              'name', COALESCE(NULLIF(v_person->>'name', ''), format('Tenant %s', v_person_idx)),
              'email', COALESCE(v_person->>'email', ''),
              'phone', COALESCE(v_person->>'phone', '')
            )
          ),
          COALESCE((payload->>'contractMonths')::INTEGER, 0),
          COALESCE(NULLIF(payload->>'formBasis', ''), 'monthly'),
          COALESCE((payload->>'rentPerCollection')::NUMERIC, 0),
          NULLIF(payload->>'rentStartDate', '')::DATE,
          v_due_day,
          TRUE,
          COALESCE((payload->>'advancePayment')::NUMERIC, 0),
          COALESCE((payload->>'securityDeposit')::NUMERIC, 0),
          0,
          v_now,
          v_now
        )
        RETURNING * INTO v_tenant;

        v_tenants := v_tenants || jsonb_build_array(to_jsonb(v_tenant));
        v_tenant_ids := array_append(v_tenant_ids, v_tenant.id);

        IF btrim(COALESCE(v_person->>'email', '')) <> '' THEN
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
              COALESCE(v_person->>'email', ''),
              COALESCE(NULLIF(v_person->>'name', ''), format('Tenant %s', v_person_idx)),
              COALESCE(v_person->>'phone', ''),
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
            NULLIF((r_schedule.elem->'tenant_rent_amounts'->>(v_current_tenant_index - 1)::TEXT), '')::NUMERIC,
            (payload->>'rentPerCollection')::NUMERIC,
            v_total_rent
          );

          v_other_charges := COALESCE(
            NULLIF((r_schedule.elem->'tenantOtherCharges'->>(v_current_tenant_index - 1)::TEXT), '')::NUMERIC,
            NULLIF((r_schedule.elem->'tenant_other_charges'->>(v_current_tenant_index - 1)::TEXT), '')::NUMERIC,
            v_total_other_charges
          );

          v_entry_status := CASE
            WHEN (COALESCE(v_rent_due, 0) + COALESCE(v_other_charges, 0)) <= 0 THEN 'Not Yet Set'
            ELSE COALESCE(r_schedule.elem->>'status', 'Not Yet Due')
          END;

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
            period_id,
            paid_amount,
            tenant_rent_amounts,
            tenant_other_charges,
            tenant_payments,
            created_at,
            updated_at
          ) VALUES (
            v_property.id,
            v_current_tenant_id,
            (r_schedule.elem->>'dueDate')::DATE,
            COALESCE(v_rent_due, 0),
            COALESCE(v_other_charges, 0),
            COALESCE(v_rent_due, 0) + COALESCE(v_other_charges, 0),
            v_entry_status,
            COALESCE(r_schedule.elem->'expenseItems', '[]'::JSONB),
            r_schedule.ordinality,
            v_period_id,
            0,
            NULL,
            NULL,
            NULL,
            v_now,
            v_now
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
